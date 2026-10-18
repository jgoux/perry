#!/usr/bin/env bash
# Storage compiled to wasip1, run under supa-host against Postgres, compared with node.
#   wasi-smoke.sh <supa-host> <node-transcript> <outdir> <label>=<module.wasm> [...]
# Per module: precompile it to a .cwasm (size, time), then start three fresh instances on fresh
# databases, each timed from launch to /status answering 200, driven through smoke.sh and its
# transcript diffed against node's:
#   100k   a 100000-byte upload
#   5mb    a 5 MiB upload
#   gc     a 100000-byte upload with the collector forced to evacuate every cycle and to verify it
#          (PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1)
# One line per run: ready time, smoke exit status, verdict against node, whether the host survived,
# RSS idle and after the smoke. Exits non-zero if any run is not IDENTICAL, died or never became ready.
# Environment: STORAGE_DIR (the checkout the module was compiled in; mounted at the same path),
# ENV_FILE (env.sh output, with SERVICE_KEY), PG_PORT (default 5432), SMOKE_PORT (default 18080).
set -uo pipefail
host=${1:?supa-host}; node_ref=${2:?node transcript}; out=${3:?outdir}; shift 3
[ $# -gt 0 ] || { echo "usage: $0 <supa-host> <node-transcript> <outdir> <label>=<module.wasm>..." >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
: "${STORAGE_DIR:?}" "${ENV_FILE:?}"
pgport=${PG_PORT:-5432}; port=${SMOKE_PORT:-18080}
export PGPASSWORD=postgres
mkdir -p "$out"; : > "$out/results.txt"
set -a; . "$ENV_FILE"; set +a
env_args=()
while IFS= read -r l; do [ -n "$l" ] && env_args+=(--env "$l"); done < "$ENV_FILE"
now() { date +%s%3N; }
rss_mb() { ps -o rss= -p "$1" 2>/dev/null | awk '{ printf "%d", $1 / 1024 }'; }
rc=0

run() { # label cwasm tag bytes [guest env...]
  local label=$1 module=$2 tag=$3 bytes=$4; shift 4
  local name=${label}_$tag db=st_${label}_$tag
  local data="$out/data_$name" log="$out/host_$name.log" smoke="$out/smoke_$name.txt"
  psql -h 127.0.0.1 -p "$pgport" -U postgres -q -c "drop database if exists $db" -c "create database $db" || return 1
  rm -rf "$data"; mkdir -p "$data"
  local guest_env=(); for e in "$@"; do guest_env+=(--env "$e"); done
  local start; start=$(now)
  "$host" run --listen "127.0.0.1:$port" --listen "127.0.0.1:$((port + 1))" \
    --dir "$STORAGE_DIR::/home/runner/storage" --dir "$STORAGE_DIR/migrations::/migrations" --rw-dir "$data::/data" \
    --env "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:$pgport/$db" --env STORAGE_FILE_BACKEND_PATH=/data \
    --env "SERVER_PORT=$port" --env "SERVER_ADMIN_PORT=$((port + 1))" --env NODE_ENV=production --env LOG_STDOUT_SYNC=true \
    "${env_args[@]}" "${guest_env[@]}" "$module" > "$log" 2>&1 &
  local pid=$! ready=""
  for _ in $(seq 1 1500); do
    sleep 0.2
    [ "$(curl -s -o /dev/null -m 2 -w '%{http_code}' "http://127.0.0.1:$port/status")" = 200 ] && { ready=$(( $(now) - start )); break; }
    kill -0 "$pid" 2>/dev/null || break
  done
  local line
  if [ -z "$ready" ]; then
    line="$name NOT-READY (host $(kill -0 "$pid" 2>/dev/null && echo alive || echo exited))"
    tail -n 40 "$log" | cut -c1-300 >&2
    rc=1
  else
    local idle; idle=$(rss_mb "$pid")
    SMOKE_BYTES=$bytes "$here/smoke.sh" "$port" "$smoke" > "$out/smoke_$name.err" 2>&1; local src=$?
    local verdict=DIFF; diff -q "$node_ref" "$smoke" > /dev/null 2>&1 && verdict=IDENTICAL
    local alive=DEAD; kill -0 "$pid" 2>/dev/null && alive=alive
    line="$name ready=${ready}ms smoke_rc=$src vs_node=$verdict host=$alive rss_idle=${idle}MB rss_after=$(rss_mb "$pid")MB"
    { [ "$src" = 0 ] && [ "$verdict" = IDENTICAL ] && [ "$alive" = alive ]; } || { rc=1; diff -u "$node_ref" "$smoke" | head -n 40 >&2; tail -n 40 "$log" | cut -c1-300 >&2; }
  fi
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 25); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  echo "$line" | tee -a "$out/results.txt"
}

for spec in "$@"; do
  label=${spec%%=*}; wasm=${spec#*=}
  cwasm="$out/$label.cwasm"
  start=$(now)
  "$host" compile "$wasm" "$cwasm" || { echo "$label: precompile failed" >&2; rc=1; continue; }
  line="$label module=$(stat -c %s "$wasm")B cwasm=$(stat -c %s "$cwasm")B precompile=$(( $(now) - start ))ms"
  echo "$line" | tee -a "$out/results.txt"
  run "$label" "$cwasm" 100k 100000
  run "$label" "$cwasm" 5mb 5242880
  run "$label" "$cwasm" gc 100000 PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1
  rm -f "$cwasm"
done
exit $rc
