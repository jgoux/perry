#!/usr/bin/env bash
# Start or stop a Storage process and wait for /status.
#   serve.sh start <label> <db> <port> <logdir> -- <command...>   (cwd = storage checkout)
#   serve.sh stop  <label> <logdir>
# Needs the env from env.sh, plus PGPORT-reachable Postgres on 127.0.0.1:${PG_PORT:-5432}.
set -euo pipefail
action=${1:?start|stop}; shift
if [ "$action" = stop ]; then
  label=$1; logdir=$2
  if [ -f "$logdir/$label.pid" ]; then
    pid=$(cat "$logdir/$label.pid")
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$pid" 2>/dev/null || true
  fi
  exit 0
fi
label=$1; db=$2; port=$3; logdir=$4; shift 4
[ "$1" = -- ] && shift
mkdir -p "$logdir"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT:-5432}/$db"
export STORAGE_FILE_BACKEND_PATH="${RUNNER_TEMP:-/tmp}/data-$label"
export SERVER_PORT=$port SERVER_ADMIN_PORT=$((port + 1))
rm -rf "$STORAGE_FILE_BACKEND_PATH"; mkdir -p "$STORAGE_FILE_BACKEND_PATH"
ulimit -c unlimited || true
"$@" > "$logdir/$label.log" 2>&1 &
pid=$!
echo "$pid" > "$logdir/$label.pid"
for i in $(seq 1 ${START_TIMEOUT:-180}); do
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid" && rc=0 || rc=$?
    echo "$label exited during startup (status $rc) after ${i}s" >&2
    tail -n 40 "$logdir/$label.log" >&2 || true
    exit 1
  fi
  if curl -fsS -m 2 -o /dev/null "http://127.0.0.1:$port/status"; then
    echo "$label ready after ${i}s (pid $pid)"
    exit 0
  fi
  sleep 1
done
echo "$label did not answer /status within ${START_TIMEOUT:-180}s" >&2
tail -n 40 "$logdir/$label.log" >&2 || true
exit 1
