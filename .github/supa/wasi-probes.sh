#!/usr/bin/env bash
# Compile each .github/supa/wasi-probes/*.js with `perry compile --target wasip1`,
# check the module's imports against the supa-wasm host, run it under wasmtime
# and compare stdout and exit status with node. Prints a verdict, the module
# size and peak RSS per probe; fails if any probe failed.
# Usage: wasi-probes.sh [name...]
#
# Markers in a probe's comments:
#   // stderr-contains: TEXT   the wasm run's stderr must contain TEXT
#   // max-rss-mb: N           the wasmtime process must stay under N MB
#   // optional: REASON        a compile or link failure is recorded as MISSING,
#                              not a failure (a probe that compiles must still match)
# Every run gets a writable scratch directory: WORK_DIR for node, preopened as
# /work for wasmtime (--dir HOST::/work), so fs probes can write files.
# Environment: PERRY_BIN, WASMTIME, WASMTIME_FLAGS, OUT.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=${OUT:-$PWD/supa-out}/wasi-probes
mkdir -p "$work"
perry=${PERRY_BIN:-$PWD/target/release/perry}
wasmtime=${WASMTIME:-wasmtime}
flags=${WASMTIME_FLAGS:--W exceptions=y}
summary=${GITHUB_STEP_SUMMARY:-/dev/null}
export PERRY_NO_AUTO_OPTIMIZE=1 PERRY_KEEP_SYMBOLS=1

names=("$@")
[ ${#names[@]} -gt 0 ] || names=($(cd "$here/wasi-probes" && ls *.js | sed 's/\.js$//'))
rc=0
rows=()
for n in "${names[@]}"; do
  d="$work/$n"; rm -rf "$d"; mkdir -p "$d"
  src="$here/wasi-probes/$n.js"; cp "$src" "$d/$n.js"
  marker() { sed -n "s|^// $1: ||p" "$src" | head -1; }
  optional=$(marker optional); want_err=$(marker stderr-contains); max_rss=$(marker max-rss-mb)
  echo "::group::probe $n"
  verdict=PASS; size=-; rss=-

  s=$(date +%s)
  if ! (cd "$d" && "$perry" compile --target wasip1 "$n.js" -o "$n.wasm" > compile.log 2>&1); then
    tail -n 25 "$d/compile.log"
    if [ -n "$optional" ]; then verdict="MISSING ($optional)"; else verdict="FAIL (compile)"; rc=1; fi
    echo "probe $n: $verdict"; echo "::endgroup::"
    rows+=("| $n | $verdict | - | - |"); continue
  fi
  echo "compile: $(( $(date +%s) - s )) s"
  size=$(stat -c %s "$d/$n.wasm")

  if ! python3 -I "$here/wasi-imports.py" --quiet "$d/$n.wasm" > "$d/imports.log" 2>&1; then
    cat "$d/imports.log"; verdict="FAIL (imports)"; rc=1
  fi

  mkdir -p "$d/work"
  # The checkout's package.json says "type": "module"; node runs the probe as CommonJS.
  cp "$d/$n.js" "$d/$n.cjs"
  (cd "$d" && WORK_DIR="$d/work" timeout 120 node "$n.cjs" > node.out 2> node.err); echo $? > "$d/node.rc"
  (cd "$d" && /usr/bin/time -v -o time.txt timeout 300 "$wasmtime" run $flags --dir "$d/work::/work" "$n.wasm" > run.out 2> run.err); echo $? > "$d/run.rc"
  rss=$(awk -F': ' '/Maximum resident set size/ {printf "%d", $2 / 1024}' "$d/time.txt")
  echo "--- stdout (wasm) ---"; head -c 3000 "$d/run.out"
  echo "--- stderr (wasm, tail) ---"; tail -n 12 "$d/run.err"
  echo "node exit $(cat "$d/node.rc"), wasm exit $(cat "$d/run.rc"), size $size B, peak RSS ${rss} MB"

  if [ "$verdict" = PASS ]; then
    if [ "$(cat "$d/node.rc")" != "$(cat "$d/run.rc")" ]; then
      verdict="FAIL (exit $(cat "$d/run.rc"), node $(cat "$d/node.rc"))"
    elif ! diff -u "$d/node.out" "$d/run.out" > "$d/stdout.diff"; then
      echo "--- stdout differs (- node, + wasm) ---"; head -n 60 "$d/stdout.diff"
      verdict="FAIL (stdout differs)"
    elif [ -n "$want_err" ] && ! grep -qF -- "$want_err" "$d/run.err"; then
      verdict="FAIL (stderr lacks: $want_err)"
    elif [ -n "$max_rss" ] && [ "$rss" -gt "$max_rss" ]; then
      verdict="FAIL (peak RSS ${rss} MB > ${max_rss} MB)"
    fi
    [ "$verdict" = PASS ] || rc=1
  fi
  echo "probe $n: $verdict"
  echo "::endgroup::"
  rows+=("| $n | $verdict | $size | $rss |")
done

{
  echo "### wasi probes (wasip1, wasmtime \`$flags\`)"
  echo "| probe | result | module bytes | peak RSS MB |"
  echo "|---|---|---|---|"
  printf '%s\n' "${rows[@]}"
} | tee -a "$summary"
exit $rc
