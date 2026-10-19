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
serve_requests() {  # outfile, server stdout file
  : > "$1"
  for _ in $(seq 1 240); do grep -q listening "$2" 2>/dev/null && break; sleep 0.5; done
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

wasm_env=()   # extra --env flags for the wasm run
run_wasm() {  # label
  local label=$1
  (timeout 300 "$wasmtime" run -W exceptions=y -W unknown-imports-trap -S preview2=n -S "tcplisten=127.0.0.1:$port" \
     "${env_flags[@]}" "${wasm_env[@]}" "$out/info-server.wasm" > "$out/srv.$label.out" 2> "$out/srv.$label.err"; echo $? > "$out/srv.$label.rc") &
  local pid=$!; serve_requests "$out/srv.$label.serve" "$out/srv.$label.out"; wait $pid
  cat "$out/srv.$label.serve" "$out/srv.$label.out" > "$out/srv.$label.all"
}

(timeout 120 node storage-info-server.js > "$out/srv.node.out" 2>&1; echo $? > "$out/srv.node.rc") &
pid=$!; serve_requests "$out/srv.node.serve" "$out/srv.node.out"; wait $pid
cat "$out/srv.node.serve" "$out/srv.node.out" > "$out/srv.node.all"
run_wasm wasm

echo "--- node: answers ---"; cat "$out/srv.node.serve"
echo "--- wasm: stdout ---"; cat "$out/srv.wasm.out"
echo "--- wasm: stderr (tail) ---"; grep -v trace-throw "$out/srv.wasm.err" | tail -n 20
echo "exit: node $(cat "$out/srv.node.rc"), wasm $(cat "$out/srv.wasm.rc")"
rc=0
diff -u "$out/srv.node.all" "$out/srv.wasm.all" || rc=1
[ "$(cat "$out/srv.node.rc")" = "$(cat "$out/srv.wasm.rc")" ] || rc=1

# Diagnostics (never gating): the same run with other collector settings.
if [ -n "${INFO_SERVER_DIAG:-}" ]; then
  for variant in "PERRY_GEN_GC=0" "PERRY_GC_FORCE_EVACUATE=1" "PERRY_GC_SCAVENGE=0"; do
    wasm_env=(--env "$variant"); label=diag-${variant%%=*}
    run_wasm "$label"
    echo "=== $variant: exit $(cat "$out/srv.$label.rc")"
    diff -u "$out/srv.node.all" "$out/srv.$label.all" | head -n 30 || true
  done
fi
exit $rc
