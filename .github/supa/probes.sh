#!/usr/bin/env bash
# Compile and run each .github/supa/probes/*.js against the Perry build in
# target/release, with the exception trace on. Prints a verdict per probe and
# fails if any probe failed. Usage: probes.sh [name...]
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=${OUT:-$PWD/supa-out}/probes
mkdir -p "$work"
perry=${PERRY_BIN:-$PWD/target/release/perry}
export PERRY_NO_AUTO_OPTIMIZE=1 PERRY_KEEP_SYMBOLS=1
names=("$@")
[ ${#names[@]} -gt 0 ] || names=($(cd "$here/probes" && ls *.js | sed 's/\.js$//'))
rc=0
for n in "${names[@]}"; do
  d="$work/$n"; rm -rf "$d"; mkdir -p "$d"; cp "$here/probes/$n.js" "$d/$n.js"
  # A <name>.fixture directory holds files (e.g. node_modules) the probe needs.
  if [ -d "$here/probes/$n.fixture" ]; then cp -R "$here/probes/$n.fixture/." "$d/"; fi
  echo "::group::probe $n"
  s=$(date +%s)
  if ! (cd "$d" && "$perry" compile "$n.js" -o "$n.bin" > compile.log 2>&1); then
    echo "probe $n: COMPILE FAILED"; tail -20 "$d/compile.log"; rc=1; echo "::endgroup::"; continue
  fi
  echo "compile: $(( $(date +%s) - s )) s"
  # Startup registration must be reachable from .init_array (not legacy .ctors).
  { echo "== .init_array =="; objdump -s -j .init_array "$d/$n.bin" 2>&1 | tail -n +4
    echo "== .ctors =="; objdump -h "$d/$n.bin" 2>&1 | grep -E '\.ctors|\.init_array' ; } > "$d/init_array.txt" 2>&1
  cat "$d/init_array.txt"
  (cd "$d" && PERRY_EH_TRACE=1 timeout 60 ./"$n.bin" > run.log 2>&1); st=$?
  head -c 4000 "$d/run.log"; echo
  # A first-line `// expect-exit: N` marks a probe that must end uncaught with
  # status N; a FATAL from the runtime's exception transport always fails.
  want=$(sed -n '1s|^// expect-exit: \([0-9][0-9]*\)$|\1|p' "$here/probes/$n.js"); want=${want:-0}
  if grep -q 'FATAL' "$d/run.log"; then echo "probe $n: FAIL (runtime FATAL)"; rc=1
  elif [ $st -eq "$want" ]; then echo "probe $n: PASS"; else echo "probe $n: FAIL (exit $st, wanted $want)"; rc=1; fi
  echo "::endgroup::"
done
exit $rc
