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
  if [ $st -eq 0 ]; then echo "probe $n: PASS"; else echo "probe $n: FAIL (exit $st)"; rc=1; fi
  echo "::endgroup::"
done
exit $rc
