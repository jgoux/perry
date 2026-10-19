#!/usr/bin/env bash
# Warm-request benchmark against a running Storage: repeated 1 MiB and 6 MiB downloads and uploads on one
# instance, after a warm-up of each. Per phase: median and mean request time (curl time_total) and, when the
# guest runs with PERRY_GC_LOG=1 and its output goes to <hostlog>, the collections that phase cost.
# usage: warm.sh <port> <outfile> [hostlog]     (needs SERVICE_KEY)
set -uo pipefail
port=${1:?port}; out=${2:?outfile}; log=${3:-/dev/null}
base=http://127.0.0.1:$port
auth="Authorization: Bearer ${SERVICE_KEY:?}"
work=$(mktemp -d)
: > "$out"

# Collections logged since line $1 of the host log: "gcs=<n> fulls=<n> gc_ms=<ms>".
gc_since() {
  tail -n +"$(($1 + 1))" "$log" 2>/dev/null | awk '
    /^\[gc-log\]/ { n++; for (i = 1; i <= NF; i++) { if ($i == "kind=full") f++; if ($i ~ /^pause_us=/) { split($i, p, "="); us += p[2] } } }
    END { printf "gcs=%d fulls=%d gc_ms=%.1f", n, f, us / 1000 }'
}
loglines() { wc -l < "$log" 2>/dev/null || echo 0; }

req() { # <expected> <curl args...>; prints time_total, fails the run on an unexpected status
  local want=$1; shift
  local got; got=$(curl -sS -m 120 -o "$work/body" -w '%{http_code} %{time_total}' "$@") || got="curl-failed 0"
  if [ "${got%% *}" != "$want" ]; then
    echo "FAIL want $want got ${got%% *}: $*" >&2; head -c 600 "$work/body" >&2; echo >&2
    echo "FAIL" >> "$out"; exit 1
  fi
  echo "${got#* }"
}

phase() { # <name> <count> <curl args producing one request; {i} is the iteration>...
  local name=$1 n=$2; shift 2
  local mark; mark=$(loglines)
  local times=() i args
  for i in $(seq 1 "$n"); do
    args=("${@//\{i\}/$i}")
    times+=("$(req 200 "${args[@]}")")
  done
  sleep 0.5 # a collection that follows the response still belongs to this phase
  printf '%s\n' "${times[@]}" | sort -n | awk -v name="$name" -v gc="$(gc_since "$mark")" '
    { t[NR] = $1; s += $1 }
    END { printf "%-14s n=%d median_ms=%.1f mean_ms=%.1f max_ms=%.1f %s\n", name, NR, t[int((NR + 1) / 2)] * 1000, s / NR * 1000, t[NR] * 1000, gc }' >> "$out"
}

head -c 1048576 /dev/urandom > "$work/1m.bin"
head -c 6291456 /dev/urandom > "$work/6m.bin"
sum1=$(sha256sum "$work/1m.bin" | cut -d' ' -f1)
echo "startup        $(gc_since 0)" >> "$out"
req 200 "$base/status" > /dev/null
req 200 -X POST "$base/bucket" -H "$auth" -H 'Content-Type: application/json' -d '{"name":"warm","public":false}' > /dev/null
req 200 -X POST "$base/object/warm/o1" -H "$auth" -H 'Content-Type: application/octet-stream' --data-binary "@$work/1m.bin" > /dev/null
req 200 -X POST "$base/object/warm/o6" -H "$auth" -H 'Content-Type: application/octet-stream' --data-binary "@$work/6m.bin" > /dev/null
req 200 "$base/object/warm/o1" -H "$auth" > /dev/null
[ "$(sha256sum "$work/body" | cut -d' ' -f1)" = "$sum1" ] || { echo "FAIL download bytes differ" >&2; echo FAIL >> "$out"; exit 1; }
req 200 "$base/object/warm/o6" -H "$auth" > /dev/null
sleep 1

phase get_1mb 20 "$base/object/warm/o1" -H "$auth"
phase get_6mb 6 "$base/object/warm/o6" -H "$auth"
phase put_1mb 12 -X POST "$base/object/warm/p1-{i}" -H "$auth" -H 'Content-Type: application/octet-stream' --data-binary "@$work/1m.bin"
phase put_6mb 4 -X POST "$base/object/warm/p6-{i}" -H "$auth" -H 'Content-Type: application/octet-stream' --data-binary "@$work/6m.bin"
echo "all_incl_start $(gc_since 0)" >> "$out"
rm -rf "$work"
