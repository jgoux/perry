#!/usr/bin/env bash
# Compile and run each .github/supa/probes/*.js against the Perry build in
# target/release, with the exception trace on. Prints a verdict per probe and
# fails if any probe failed. Usage: probes.sh [name...]
# Optional markers in a probe's comments:
#   // npm: SPEC...   install these npm packages next to a node copy of the probe
#   // bundle-npm     also put that node_modules next to the compiled copy
#   // compare-node   run the probe under node too and require identical output
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
  src="$here/probes/$n.js"
  specs=$(sed -n 's|^// npm: ||p' "$src" | head -1)
  cmp_node=false; grep -q '^// compare-node$' "$src" && cmp_node=true
  if [ -n "$specs" ] || $cmp_node; then
    # The reference run: same file under node, with the npm packages installed.
    ref="$d/node-ref"; mkdir -p "$ref"; cp "$src" "$ref/$n.js"
    if grep -q '^import ' "$src"; then t=module; else t=commonjs; fi
    echo "{\"private\":true,\"type\":\"$t\"}" > "$ref/package.json"
    if [ -n "$specs" ]; then
      if ! (cd "$ref" && npm install --no-audit --no-fund --loglevel=error $specs); then
        echo "probe $n: NPM INSTALL FAILED"; rc=1; echo "::endgroup::"; continue
      fi
      echo "== installed =="; (cd "$ref" && npm ls --all 2>/dev/null | grep -oE '(fastify|find-my-way|ajv|fast-json-stringify)@[0-9][^ ]*' | sort -u)
    fi
    if $cmp_node; then
      (cd "$ref" && timeout 60 node "$n.js" > "$d/node.log" 2>&1); echo "== node (exit $?) =="; head -c 4000 "$d/node.log"; echo
    fi
    if grep -q '^// bundle-npm$' "$src"; then cp -r "$ref/node_modules" "$d/node_modules"; fi
  fi
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
  elif [ $st -ne "$want" ]; then echo "probe $n: FAIL (exit $st, wanted $want)"; rc=1
  elif $cmp_node && ! diff -u "$d/node.log" "$d/run.log" > "$d/node.diff"; then
    echo "probe $n: FAIL (output differs from node: - node, + perry)"; cat "$d/node.diff"; rc=1
  else echo "probe $n: PASS"; fi
  echo "::endgroup::"
done
exit $rc
