#!/usr/bin/env bash
# Smoke flow against a running Storage: /status, create bucket, upload, download (bytes identical), list.
# Writes a normalized transcript to <outfile>; exits non-zero on the first failed expectation.
# usage: smoke.sh <port> <outfile>     (needs SERVICE_KEY; SMOKE_BYTES sets the upload size, default 100000)
set -uo pipefail
port=${1:?port}; out=${2:?outfile}
base=http://127.0.0.1:$port
auth=("Authorization: Bearer ${SERVICE_KEY:?}")
work=$(mktemp -d)
: > "$out"
fail=0

step() { # <name> <expected status> <curl args...> ; body -> $work/body
  local name=$1 want=$2; shift 2
  local got
  got=$(curl -sS -m 60 -o "$work/body" -w '%{http_code}' "$@") || got=curl-failed
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
echo "smoke ok" >> "$out"
exit $fail
