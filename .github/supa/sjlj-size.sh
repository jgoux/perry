#!/usr/bin/env bash
# How the code of a function that calls setjmp (any try/catch/finally or
# for...of with an iterator-close) grows with its calls and live values, with
# and without the post-optimizer slot demotion (PERRY_WASM_SJLJ_DEMOTE, P55).
#
# Each variant is a function `run` of N steps whose results stay live until the
# end, compiled twice with `perry compile --target wasip1`. The table counts,
# in `run` alone, the wasm stores and the lines of text format; it goes to the
# job summary. Fails when demotion does not shrink the largest `try` variant,
# or when a demoted module's output differs from node's.
# Usage: sjlj-size.sh [N...]
# Environment: PERRY_BIN, WASMTIME, WASMTIME_FLAGS, OUT.
set -uo pipefail
work=${OUT:-$PWD/supa-out}/sjlj-size
mkdir -p "$work"
perry=${PERRY_BIN:-$PWD/target/release/perry}
wasmtime=${WASMTIME:-wasmtime}
flags=${WASMTIME_FLAGS:--W exceptions=y}
summary=${GITHUB_STEP_SUMMARY:-/dev/null}
export PERRY_NO_AUTO_OPTIMIZE=1 PERRY_KEEP_SYMBOLS=1
sizes=("$@"); [ ${#sizes[@]} -gt 0 ] || sizes=(16 32 64 128)

# gen KIND N: print the source of one variant.
gen() {
  local kind=$1 n=$2 i
  echo 'function f(n) { return { v: n + 1 }; }'
  echo 'function g(o) { return o.v; }'
  echo 'function run() {'
  echo '  let s = 0;'
  case $kind in
    try)
      echo '  try {'
      for ((i = 0; i < n; i++)); do
        echo "    const o$i = f($i); const v$i = g(o$i); if (v$i > $((i + 100))) s += v$i;"
      done
      printf '    s += 0'; for ((i = 0; i < n; i++)); do printf ' + v%d' "$i"; done; echo ';'
      echo '  } catch (e) { return -17; }'
      ;;
    finally)
      echo '  try {'
      for ((i = 0; i < n; i++)); do
        echo "    const o$i = f($i); const v$i = g(o$i); if (v$i > $((i + 100))) s += v$i;"
      done
      printf '    s += 0'; for ((i = 0; i < n; i++)); do printf ' + v%d' "$i"; done; echo ';'
      echo '  } finally { s += 1; }'
      ;;
    forof)
      for ((i = 0; i < n; i++)); do
        echo "  const a$i = [f($i), f($i + 1)];"
        echo "  for (const x of a$i) { s += g(x); }"
      done
      printf '  s += 0'; for ((i = 0; i < n; i++)); do printf ' + a%d.length' "$i"; done; echo ';'
      ;;
  esac
  echo '  return s;'
  echo '}'
  echo 'console.log(run());'
}

# measure NAME DEMOTE: compile, print "stores lines bytes" of `run`.
measure() {
  local name=$1 demote=$2 d="$work/$1-$2"
  rm -rf "$d"; mkdir -p "$d"; cp "$work/$name.js" "$d/$name.js"
  if ! (cd "$d" && PERRY_WASM_SJLJ_DEMOTE=$demote "$perry" compile --target wasip1 "$name.js" -o "$name.wasm" > compile.log 2>&1); then
    tail -n 20 "$d/compile.log" >&2; echo "FAIL FAIL FAIL"; return 1
  fi
  wasm-tools print "$d/$name.wasm" > "$d/$name.wat" || { echo "FAIL FAIL FAIL"; return 1; }
  awk -v want="__run" '
    /^  \(func \$perry_fn_/ { n = $2; sub(/^\$/, "", n); keep = (n ~ want "$") }
    keep { lines++; if ($0 ~ /store/) stores++ }
    keep && /^  \)/ { keep = 0 }
    END { printf "%d %d", stores, lines }
  ' "$d/$name.wat" | tr '\n' ' '
  stat -c %s "$d/$name.wasm"
  rm -f "$d/$name.wat"
}

rc=0
rows=("| variant | N | stores off | stores on | lines off | lines on | module off | module on |" "|---|---|---|---|---|---|---|---|")
declare -A off_stores on_stores
for kind in try finally forof; do
  for n in "${sizes[@]}"; do
    name="sjlj_${kind}_$n"
    gen "$kind" "$n" > "$work/$name.js"
    node "$work/$name.js" > "$work/$name.node.out" 2>&1
    echo "::group::$name"
    read -r so lo mo < <(measure "$name" 0)
    read -r sn ln mn < <(measure "$name" 1)
    # Both builds must print what node prints.
    for d in 0 1; do
      # shellcheck disable=SC2086
      if ! "$wasmtime" $flags run "$work/$name-$d/$name.wasm" > "$work/$name-$d/out.txt" 2> "$work/$name-$d/err.txt" \
        || ! cmp -s "$work/$name.node.out" "$work/$name-$d/out.txt"; then
        echo "::error::$name (demote=$d) differs from node: $(head -c 200 "$work/$name-$d/out.txt") | $(head -c 300 "$work/$name-$d/err.txt")"
        rc=1
      fi
    done
    echo "$name: stores $so -> $sn, lines $lo -> $ln, module $mo -> $mn"
    echo "::endgroup::"
    rows+=("| $kind | $n | $so | $sn | $lo | $ln | $mo | $mn |")
    off_stores[$kind,$n]=$so; on_stores[$kind,$n]=$sn
    if [ "$so" = FAIL ] || [ "$sn" = FAIL ]; then rc=1; fi
  done
done
{
  echo "### sjlj slot demotion (P55)"
  printf '%s\n' "${rows[@]}"
} | tee -a "$summary"

largest=${sizes[${#sizes[@]}-1]}
so=${off_stores[try,$largest]:-0}; sn=${on_stores[try,$largest]:-0}
if [ "$so" != FAIL ] && [ "$sn" != FAIL ] && ! [ "$sn" -lt "$so" ]; then
  echo "::error::demotion did not shrink the try variant at N=$largest ($so -> $sn stores)"; rc=1
fi
exit $rc
