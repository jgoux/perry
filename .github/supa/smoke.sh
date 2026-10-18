#!/usr/bin/env bash
# Smoke flow against a running Storage: /status, create bucket, upload, download (bytes identical), list,
# then four error paths (invalid key, duplicate upload, missing object, bad JWT) whose bodies must match node.
# Storage answers each of them with HTTP 400 and the real status in the body's statusCode.
# Then object info and HEAD, authenticated and public.
# Writes a normalized transcript to <outfile>; exits non-zero on the first failed expectation.
# usage: smoke.sh <port> <outfile>     (needs SERVICE_KEY; SMOKE_BYTES sets the upload size, default 100000)
set -uo pipefail
port=${1:?port}; out=${2:?outfile}
base=http://127.0.0.1:$port
auth=("Authorization: Bearer ${SERVICE_KEY:?}")
work=$(mktemp -d)
timing=${out%.txt}-timing.txt # seconds per request, kept out of the transcript that is diffed
: > "$out"; : > "$timing"
fail=0

step() { # <name> <expected status> <curl args...> ; body -> $work/body
  local name=$1 want=$2; shift 2
  local got
  got=$(curl -sS -m 60 -o "$work/body" -w '%{http_code} %{time_total}' "$@") || got="curl-failed 0"
  printf '%s %s\n' "$name" "${got#* }" >> "$timing"
  got=${got%% *}
  printf '%s -> %s\n' "$name" "$got" >> "$out"
  if [ "$got" != "$want" ]; then
    printf 'FAIL %s: want %s got %s\n' "$name" "$want" "$got" | tee -a "$out" >&2
    head -c 600 "$work/body" >&2 || true; echo >&2
    fail=1
    return 1
  fi
}
norm() { jq -S -c "$1" "$work/body" >> "$out"; }

head -c "${SMOKE_BYTES:-100000}" /dev/urandom > "$work/up.bin"
want_sum=$(sha256sum "$work/up.bin" | cut -d' ' -f1)

step "GET /status" 200 "$base/status" || exit 1
step "POST /bucket" 200 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
  -d '{"name":"smoke","public":false}' || exit 1
norm '.'
step "POST /object/smoke/hello.bin" 200 -X POST "$base/object/smoke/hello.bin" -H "${auth[0]}" \
  -H 'Content-Type: application/octet-stream' --data-binary @"$work/up.bin" || exit 1
norm 'del(.Id)'
step "GET /object/smoke/hello.bin" 200 "$base/object/smoke/hello.bin" -H "${auth[0]}" || exit 1
got_sum=$(sha256sum "$work/body" | cut -d' ' -f1)
if [ "$got_sum" = "$want_sum" ]; then
  echo "download bytes identical" >> "$out"
else
  echo "FAIL download bytes differ: want $want_sum got $got_sum" | tee -a "$out" >&2
  exit 1
fi
step "GET /bucket" 200 "$base/bucket" -H "${auth[0]}" || exit 1
norm 'map(del(.created_at, .updated_at))'
step "POST /object/list/smoke" 200 -X POST "$base/object/list/smoke" -H "${auth[0]}" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":10,"offset":0}' || exit 1
norm 'map({name})'
# Error paths: Storage's error objects carry their own statusCode/code, rendered through
# StorageBackendError.render(); a runtime that loses them answers FST_ERR_FAILED_ERROR_SERIALIZATION.
step "POST /object/smoke/bad^key.bin (invalid key)" 400 -X POST "$base/object/smoke/bad%5Ekey.bin" -H "${auth[0]}" \
  -H 'Content-Type: application/octet-stream' --data-binary @"$work/up.bin" || exit 1
norm '.'
step "POST /object/smoke/hello.bin (exists, no upsert)" 400 -X POST "$base/object/smoke/hello.bin" -H "${auth[0]}" \
  -H 'Content-Type: application/octet-stream' --data-binary @"$work/up.bin" || exit 1
norm '.'
step "GET /object/smoke/missing.bin" 400 "$base/object/smoke/missing.bin" -H "${auth[0]}" || exit 1
norm '.'
step "GET /bucket (bad JWT)" 400 "$base/bucket" -H 'Authorization: Bearer not.a.jwt' || exit 1
norm '.'
# Object info and HEAD, authenticated and public. A failing step does not stop the flow, so
# one run reports every route; a route that kills the server shows as curl-failed after it.
step "HEAD /object/authenticated/smoke/hello.bin" 200 -I "$base/object/authenticated/smoke/hello.bin" -H "${auth[0]}"
step "HEAD /object/smoke/hello.bin" 200 -I "$base/object/smoke/hello.bin" -H "${auth[0]}"
step "GET /object/info/smoke/hello.bin" 200 "$base/object/info/smoke/hello.bin" -H "${auth[0]}" \
  && norm 'del(.id, .version, .etag, .last_modified, .created_at)'
step "GET /object/info/authenticated/smoke/hello.bin" 200 "$base/object/info/authenticated/smoke/hello.bin" -H "${auth[0]}" \
  && norm 'del(.id, .version, .etag, .last_modified, .created_at)'
step "GET /object/info/authenticated/smoke/missing.bin" 400 "$base/object/info/authenticated/smoke/missing.bin" -H "${auth[0]}" \
  && norm '.'
step "GET /object/info/public/smoke/hello.bin (private bucket)" 404 "$base/object/info/public/smoke/hello.bin" \
  && norm '.'
step "POST /bucket (public)" 200 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
  -d '{"name":"smokepub","public":true}' && norm '.'
step "POST /object/smokepub/pub.txt" 200 -X POST "$base/object/smokepub/pub.txt" -H "${auth[0]}" \
  -H 'Content-Type: text/plain' --data-binary 'public object' && norm 'del(.Id)'
step "GET /object/info/public/smokepub/pub.txt" 200 "$base/object/info/public/smokepub/pub.txt" \
  && norm 'del(.id, .version, .etag, .last_modified, .created_at)'
step "HEAD /object/public/smokepub/pub.txt" 200 -I "$base/object/public/smokepub/pub.txt"
if [ "$fail" = 0 ]; then echo "smoke ok" >> "$out"; fi
exit $fail
