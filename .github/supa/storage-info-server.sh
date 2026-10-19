#!/usr/bin/env bash
# Run storage-info-server.js under node and compiled to wasip1 under wasmtime
# (the legacy preview1 build hands the guest its listener), send both the same
# requests with curl and compare the answers, the server's stdout and exit status.
# Run from the Storage checkout with the Storage environment exported.
# Environment: PERRY_BIN, WASMTIME_P1, OUT, and env_flags (array) is rebuilt from
# the variables listed in $WASM_ENV_FILE (KEY=VALUE lines).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
perry=${PERRY_BIN:?}; wasmtime=${WASMTIME_P1:?}; out=${OUT:?}
port=18331
cp "$here/storage-info-server.js" storage-info-server.js
env_flags=(); while IFS= read -r kv; do env_flags+=(--env "$kv"); done < "${WASM_ENV_FILE:?}"
"$perry" compile --target wasip1 storage-info-server.js -o "$out/info-server.wasm" 2>&1 | tail -n 3

requests=(
  "HEAD /head/a.bin"
  "GET /info/a.bin"
  "GET /info/a.bin"
  "GET /object"
  "GET /throws"
  "AUTH GET /object/info/authenticated/b/a.bin"
  "AUTH HEAD /object/authenticated/b/a.bin"
  "GET /object/info/pub/a.bin"
  "GET /object/info/public/pub/a.bin"
  "HEAD /object/public/pub/a.bin"
  "GET /object/info/public/b/a.bin"
  "AUTH GET /object/info/authenticated/nobucket/a.bin"
  "AUTH GET /object/info/authenticated/b/a.bin?width=100&resize=cover"
  "GET /quit"
)
serve_requests() {  # outfile
  : > "$1"
  for line in "${requests[@]}"; do
    method=${line%% *}; path=${line#* }; auth=()
    if [ "$method" = AUTH ]; then auth=(-H 'Authorization: Bearer x'); method=${path%% *}; path=${path#* }; line="AUTH $method $path"; fi
    args=("${auth[@]}" -s -S --max-time 60 --retry 60 --retry-delay 1 --retry-connrefused -H 'Connection: close' -D "$out/h.txt" -o "$out/b.txt")
    if [ "$method" = HEAD ]; then args+=(--head); else args+=(-X "$method"); fi
    { echo "> $line"
      if curl "${args[@]}" "http://127.0.0.1:$port$path"; then
        head -n1 "$out/h.txt" | tr -d '\r'
        grep -i '^content-type:' "$out/h.txt" | tr -d '\r' | tr 'A-Z' 'a-z'
        [ "$method" = HEAD ] || { cat "$out/b.txt"; echo; }
      else echo "curl failed: $?"; fi
    } >> "$1"
  done
}

(timeout 120 node storage-info-server.js > "$out/srv.node.out" 2>&1; echo $? > "$out/srv.node.rc") &
pid=$!; serve_requests "$out/srv.node.serve"; wait $pid
(timeout 300 "$wasmtime" run -W exceptions=y -W unknown-imports-trap -S preview2=n -S "tcplisten=127.0.0.1:$port" \
   "${env_flags[@]}" --env PERRY_TRACE_THROW=1 "$out/info-server.wasm" > "$out/srv.wasm.out" 2> "$out/srv.wasm.err"; echo $? > "$out/srv.wasm.rc") &
pid=$!; serve_requests "$out/srv.wasm.serve"; wait $pid

echo "--- node: answers ---"; cat "$out/srv.node.serve"
echo "--- wasm: answers ---"; cat "$out/srv.wasm.serve"
echo "--- wasm: stdout ---"; cat "$out/srv.wasm.out"
echo "--- wasm: stderr (tail) ---"; tail -n 40 "$out/srv.wasm.err"
echo "exit: node $(cat "$out/srv.node.rc"), wasm $(cat "$out/srv.wasm.rc")"
rc=0
cat "$out/srv.node.serve" "$out/srv.node.out" > "$out/srv.node.all"
cat "$out/srv.wasm.serve" "$out/srv.wasm.out" > "$out/srv.wasm.all"
diff -u "$out/srv.node.all" "$out/srv.wasm.all" || rc=1
[ "$(cat "$out/srv.node.rc")" = "$(cat "$out/srv.wasm.rc")" ] || rc=1
exit $rc
