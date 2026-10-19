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
# Error paths: every rejected request must carry node's status and body. They go through the
# validators that are built lazily (fastify's route schemas, the S3 router's) and through
# the error handlers that format their failures.
step "POST /bucket (invalid json)" 400 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
  -d '{"name":' || exit 1
norm '.'
step "POST /bucket (wrong type)" 400 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
  -d '{"name":"smoke2","public":"maybe"}' || exit 1
norm '.'
step "GET /bucket (bad query)" 400 "$base/bucket?limit=abc" -H "${auth[0]}" || exit 1
norm '.'
step "POST /object/list/smoke (invalid body)" 400 -X POST "$base/object/list/smoke" -H "${auth[0]}" \
  -H 'Content-Type: application/json' -d '{"limit":"abc"}' || exit 1
norm '.'
if [ -n "${S3_PROTOCOL_ACCESS_KEY_ID:-}" ]; then
  s3=(--user "$S3_PROTOCOL_ACCESS_KEY_ID:${S3_PROTOCOL_ACCESS_KEY_SECRET:?}" --aws-sigv4 'aws:amz:us-east-1:s3')
  step "GET /s3/smoke (ListObjectsV2)" 200 "${s3[@]}" "$base/s3/smoke?list-type=2" || exit 1
  step "GET /s3/smoke (bad max-keys)" 400 "${s3[@]}" "$base/s3/smoke?list-type=2&max-keys=abc" || exit 1
  cat "$work/body" >> "$out"; echo >> "$out"
fi
# A StorageBackendError thrown by the handler (a renderable error, not a schema failure): the
# error handler's {...error.render(), error: error.error} needs the derived instance's own
# fields, which a runtime that loses them turns into a 500 FST_ERR_FAILED_ERROR_SERIALIZATION.
# Runs by default now that super() into a native Error initialises them; SMOKE_RENDERABLE_ERRORS=0
# skips it.
if [ "${SMOKE_RENDERABLE_ERRORS:-1}" != 0 ]; then
  step "POST /bucket (invalid name)" 400 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
    -d '{"name":"bad/name","public":false}' || exit 1
  norm '.'
fi
# The info body carries the object size, which follows SMOKE_BYTES; compare it to the upload instead
# of recording it, so every size variant diffs against the one node transcript.
info_norm='del(.id, .version, .etag, .last_modified, .created_at) | .size = (.size == ((env.SMOKE_BYTES // "100000") | tonumber))'
# Object info and HEAD, authenticated and public. A failing step does not stop the flow, so
# one run reports every route; a route that kills the server shows as curl-failed after it.
step "HEAD /object/authenticated/smoke/hello.bin" 200 -I "$base/object/authenticated/smoke/hello.bin" -H "${auth[0]}"
step "HEAD /object/smoke/hello.bin" 200 -I "$base/object/smoke/hello.bin" -H "${auth[0]}"
step "GET /object/info/smoke/hello.bin" 200 "$base/object/info/smoke/hello.bin" -H "${auth[0]}" \
  && norm "$info_norm"
step "GET /object/info/authenticated/smoke/hello.bin" 200 "$base/object/info/authenticated/smoke/hello.bin" -H "${auth[0]}" \
  && norm "$info_norm"
step "GET /object/info/authenticated/smoke/missing.bin" 400 "$base/object/info/authenticated/smoke/missing.bin" -H "${auth[0]}" \
  && norm '.'
step "GET /object/info/public/smoke/hello.bin (private bucket)" 400 "$base/object/info/public/smoke/hello.bin" \
  && norm '.'
step "POST /bucket (public)" 200 -X POST "$base/bucket" -H "${auth[0]}" -H 'Content-Type: application/json' \
  -d '{"name":"smokepub","public":true}' && norm '.'
step "POST /object/smokepub/pub.txt" 200 -X POST "$base/object/smokepub/pub.txt" -H "${auth[0]}" \
  -H 'Content-Type: text/plain' --data-binary 'public object' && norm 'del(.Id)'
step "GET /object/info/public/smokepub/pub.txt" 200 "$base/object/info/public/smokepub/pub.txt" \
  && norm "$info_norm"
step "HEAD /object/public/smokepub/pub.txt" 200 -I "$base/object/public/smokepub/pub.txt"
# Optional probes of what the dependency-removal variants touch (SMOKE_EXTRA=1): status codes of the
# docs endpoint, the S3 protocol (sigv4 signed by curl), TUS and the feature routes. They never fail the
# smoke; the transcript lines show up in the diff against node, and in a variant's diff against the
# unstubbed reference.
if [ -n "${SMOKE_EXTRA:-}" ]; then
  probe() { # <name> <curl args...> ; status only, body -> $work/pbody
    local name=$1 got; shift
    got=$(curl -sS -m 60 -o "$work/pbody" -w '%{http_code}' "$@") || got=curl-failed
    printf 'extra %s -> %s\n' "$name" "$got" >> "$out"
  }
  s3() { # <name> <method> <path-and-query> [body file] ; sigv4 signed, payload hash given
    local name=$1 method=$2 url=$3 file=${4:-} hash args=()
    if [ -n "$file" ]; then hash=$(sha256sum "$file" | cut -d' ' -f1); args=(--data-binary @"$file" -X "$method"); else hash=$(printf '' | sha256sum | cut -d' ' -f1); args=(-X "$method"); fi
    [ "$method" = HEAD ] && args=(-I)
    probe "$name" "${args[@]}" --aws-sigv4 'aws:amz:us-east-1:s3' --user "${S3_PROTOCOL_ACCESS_KEY_ID:-}:${S3_PROTOCOL_ACCESS_KEY_SECRET:-}" \
      -H "x-amz-content-sha256: $hash" "$base$url"
  }
  probe "GET /documentation/json" "$base/documentation/json"
  probe "GET /documentation/" "$base/documentation/"
  probe "GET /health" "$base/health" -H "${auth[0]}"
  s3 "S3 ListBuckets" GET /s3/
  grep -q '<Name>smoke</Name>' "$work/pbody" && echo "extra S3 ListBuckets lists the bucket" >> "$out" || echo "extra S3 ListBuckets does not list the bucket" >> "$out"
  head -c 1000 /dev/urandom > "$work/s3.bin"
  s3 "S3 PutObject" PUT /s3/smoke/s3.bin "$work/s3.bin"
  s3 "S3 GetObject" GET /s3/smoke/s3.bin
  [ "$(sha256sum < "$work/pbody")" = "$(sha256sum < "$work/s3.bin")" ] && echo "extra S3 GetObject bytes identical" >> "$out" || echo "extra S3 GetObject bytes differ" >> "$out"
  s3 "S3 HeadObject" HEAD /s3/smoke/s3.bin
  s3 "S3 ListObjectsV2" GET '/s3/smoke?list-type=2&prefix=s3.'
  grep -q '<Key>s3.bin</Key>' "$work/pbody" && echo "extra S3 ListObjectsV2 lists the object" >> "$out" || echo "extra S3 ListObjectsV2 does not list the object" >> "$out"
  s3 "S3 DeleteObject" DELETE /s3/smoke/s3.bin
  # TUS: create an upload of 11 bytes and send them (bucket smoke, object tus.bin)
  tus=(-H "${auth[0]}" -H 'Tus-Resumable: 1.0.0')
  got=$(curl -sS -m 60 -D "$work/tus.headers" -o /dev/null -w '%{http_code}' -X POST "$base/upload/resumable" "${tus[@]}" -H 'Upload-Length: 11' \
    -H 'Upload-Metadata: bucketName c21va2U=,objectName dHVzLmJpbg==,contentType dGV4dC9wbGFpbg==,cacheControl bWF4LWFnZT0zNjAw') || got=curl-failed
  printf 'extra TUS create -> %s\n' "$got" >> "$out"
  loc=$(tr -d '\r' < "$work/tus.headers" | sed -n 's/^[Ll]ocation: *//p' | head -n 1 | sed -E 's#^https?://[^/]+##')
  if [ -n "$loc" ]; then
    probe "TUS patch" -X PATCH "$base$loc" "${tus[@]}" -H 'Upload-Offset: 0' -H 'Content-Type: application/offset+octet-stream' --data-binary 'hello world'
    probe "TUS download" "$base/object/smoke/tus.bin" -H "${auth[0]}"
    [ "$(cat "$work/pbody")" = 'hello world' ] && echo "extra TUS download bytes identical" >> "$out" || echo "extra TUS download bytes differ" >> "$out"
  else
    echo "extra TUS no location" >> "$out"
  fi
  # Feature routes that are off in this environment: the status shows whether they are still registered
  probe "GET /render/image/authenticated" "$base/render/image/authenticated/smoke/hello.bin" -H "${auth[0]}"
  probe "POST /vector/ListVectorBuckets" -X POST "$base/vector/ListVectorBuckets" -H "${auth[0]}" -H 'Content-Type: application/json' -d '{}'
  probe "GET /iceberg/v1/config" "$base/iceberg/v1/config?warehouse=smoke" -H "${auth[0]}"
fi
if [ "$fail" = 0 ]; then echo "smoke ok" >> "$out"; fi
exit $fail
