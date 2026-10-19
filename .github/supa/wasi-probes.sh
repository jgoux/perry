#!/usr/bin/env bash
# Compile each .github/supa/wasi-probes/*.js with `perry compile --target wasip1`,
# check the module's imports against the supa-wasm host, run it under wasmtime
# and compare stdout and exit status with node. Prints a verdict, the module
# size and peak RSS per probe; fails if any probe failed.
# Usage: wasi-probes.sh [name...]
#
# Markers in a probe's comments:
#   // stderr-contains: TEXT   the wasm run's stderr must contain TEXT
#   // stderr-max-count: N TEXT  at most N lines of the wasm run's stderr may contain TEXT
#                              (a bound on logged collections, with wasm-env PERRY_GC_LOG=1)
#   // max-rss-mb: N           the wasmtime process must stay under N MB
#   // optional: REASON        a compile or link failure is recorded as MISSING,
#                              not a failure (a probe that compiles must still match)
#   // network: yes            the module may import supa_net (see wasi-imports.py); it
#                              runs with unknown imports trapping, so a module that links
#                              the net code but never opens a socket still starts
#   // compile-only: REASON    compile and check imports but do not run (needs a
#                              service the CI runner lacks; the module is uploaded
#                              for local runs under supa-host)
#   // npm: PACKAGE            `npm install PACKAGE` next to the probe before compiling
#   // wasm-env: NAME=VALUE... space-separated variables handed to the wasm run only
#                              (--env), e.g. PERRY_GC_FORCE_EVACUATE=1
#   // server-port: PORT       the probe serves HTTP on 127.0.0.1:PORT. node runs it
#                              on that port; wasmtime gets the listener as
#                              `-S preview2=n -S tcplisten=127.0.0.1:PORT` (the
#                              legacy p1 implementation, which wasmtime 47 removed,
#                              so $WASMTIME_P1 must be 46.x), with unknown imports
#                              trapping because the module carries supa_net. After
#                              the server is up, every `// request: METHOD PATH [BODY]`
#                              line is sent with curl and the status line,
#                              content-type and body are compared with node's, as
#                              well as the server's stdout and exit status.
# Every run gets a writable scratch directory: WORK_DIR for node, preopened as
# /work for wasmtime (--dir HOST::/work), so fs probes can write files.
# Environment: PERRY_BIN, WASMTIME, WASMTIME_P1 (server probes), WASMTIME_FLAGS, OUT.
# Every probe that ran is recorded as `name<TAB>verdict` in $OUT/wasi-probes.ran, which the
# wasi-linux shards upload and wasi-verify.sh checks (each probe exactly once across shards).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=${OUT:-$PWD/supa-out}/wasi-probes
mkdir -p "$work"
perry=${PERRY_BIN:-$PWD/target/release/perry}
wasmtime=${WASMTIME:-wasmtime}
wasmtime_p1=${WASMTIME_P1:-$wasmtime}
flags=${WASMTIME_FLAGS:--W exceptions=y}
summary=${GITHUB_STEP_SUMMARY:-/dev/null}
export PERRY_NO_AUTO_OPTIMIZE=1 PERRY_KEEP_SYMBOLS=1

names=("$@")
[ ${#names[@]} -gt 0 ] || names=($(cd "$here/wasi-probes" && ls *.js | sed 's/\.js$//'))
rc=0
rows=()
ran=${OUT:-$PWD/supa-out}/wasi-probes.ran; : > "$ran"
for n in "${names[@]}"; do
  d="$work/$n"; rm -rf "$d"; mkdir -p "$d"
  src="$here/wasi-probes/$n.js"; cp "$src" "$d/$n.js"
  marker() { sed -n "s|^// $1: ||p" "$src" | head -1; }
  optional=$(marker optional); want_err=$(marker stderr-contains); err_bound=$(marker stderr-max-count); max_rss=$(marker max-rss-mb)
  network=$(marker network); compile_only=$(marker compile-only); npm_pkg=$(marker npm)
  wasm_env=$(marker wasm-env); env_flags=(); for kv in $wasm_env; do env_flags+=(--env "$kv"); done
  port=$(marker server-port); requests=$(sed -n "s|^// request: ||p" "$src")
  echo "::group::probe $n"
  verdict=PASS; size=-; rss=-

  if [ -n "$npm_pkg" ]; then
    (cd "$d" && npm install --no-save --no-audit --no-fund --loglevel=error "$npm_pkg") || { echo "npm install $npm_pkg failed"; }
  fi
  s=$(date +%s)
  if ! (cd "$d" && "$perry" compile --target wasip1 "$n.js" -o "$n.wasm" > compile.log 2>&1); then
    tail -n 25 "$d/compile.log"
    if [ -n "$optional" ]; then verdict="MISSING ($optional)"; else verdict="FAIL (compile)"; rc=1; fi
    echo "probe $n: $verdict"; echo "::endgroup::"
    rows+=("| $n | $verdict | - | - |"); printf '%s\t%s\n' "$n" "$verdict" >> "$ran"; continue
  fi
  echo "compile: $(( $(date +%s) - s )) s"
  size=$(stat -c %s "$d/$n.wasm")

  net_flag=; [ -n "$network" ] && net_flag=--allow-supa-net
  if ! python3 -I "$here/wasi-imports.py" --quiet $net_flag "$d/$n.wasm" > "$d/imports.log" 2>&1; then
    cat "$d/imports.log"; verdict="FAIL (imports)"; rc=1
  fi
  if [ -n "$compile_only" ]; then
    echo "probe $n: $verdict (compile only: $compile_only)"; echo "::endgroup::"
    rows+=("| $n | $verdict (compile only) | $size | - |"); printf '%s\t%s\n' "$n" "$verdict" >> "$ran"; continue
  fi

  mkdir -p "$d/work"
  # The checkout's package.json says "type": "module"; node runs the probe as CommonJS,
  # or as an ES module when it uses static imports.
  ext=cjs; grep -q '^import ' "$src" && ext=mjs
  cp "$d/$n.js" "$d/$n.$ext"
  if [ -n "$port" ]; then
    # Server probe: the same requests against node, then against the wasm module.
    serve_requests() {  # out
      : > "$1"
      while IFS= read -r line; do
        [ -n "$line" ] || continue
        method=${line%% *}; rest=${line#* }; path=${rest%% *}; body=
        [ "$rest" != "$path" ] && body=${rest#* }
        args=(-s -S --max-time 120 --retry 60 --retry-delay 1 --retry-connrefused
              -H 'Connection: close' -D "$d/h.txt" -o "$d/b.txt" -X "$method")
        if [[ "$body" == @bytes:* ]]; then
          head -c "${body#@bytes:}" /dev/zero | tr '\0' x > "$d/req-body.bin"
          args+=(--data-binary "@$d/req-body.bin" -H 'Content-Type: application/octet-stream')
        elif [ -n "$body" ]; then
          args+=(--data-binary "$body" -H 'Content-Type: text/plain')
        fi
        { echo "> $line"
          if curl "${args[@]}" "http://127.0.0.1:$port$path"; then
            head -n1 "$d/h.txt" | tr -d '\r'
            grep -i '^content-type:' "$d/h.txt" | tr -d '\r' | tr 'A-Z' 'a-z'
            cat "$d/b.txt"; echo
          else echo "curl failed: $?"; fi
        } >> "$1"
      done <<< "$requests"
    }
    (cd "$d" && WORK_DIR="$d/work" timeout 120 node "$n.$ext" > node.out 2> node.err; echo $? > node.rc) &
    node_pid=$!
    serve_requests "$d/node.serve"; wait $node_pid
    (cd "$d" && /usr/bin/time -v -o time.txt timeout 300 "$wasmtime_p1" run $flags "${env_flags[@]}" -W unknown-imports-trap -S preview2=n -S "tcplisten=127.0.0.1:$port" --dir "$d/work::/work" "$n.wasm" > run.out 2> run.err; echo $? > run.rc) &
    wasm_pid=$!
    serve_requests "$d/run.serve"; wait $wasm_pid
    cat "$d/node.serve" >> "$d/node.out"; cat "$d/run.serve" >> "$d/run.out"
  else
    (cd "$d" && WORK_DIR="$d/work" timeout 120 node "$n.$ext" > node.out 2> node.err); echo $? > "$d/node.rc"
    # A module that imports supa_net but never calls it needs wasmtime to trap on the import
    # instead of refusing to instantiate.
    trap_flag=; [ -n "$network" ] && trap_flag="-W unknown-imports-trap"
    (cd "$d" && /usr/bin/time -v -o time.txt timeout 300 "$wasmtime" run $flags $trap_flag "${env_flags[@]}" --dir "$d/work::/work" "$n.wasm" > run.out 2> run.err); echo $? > "$d/run.rc"
  fi
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
    elif [ -n "$err_bound" ] && [ "$(grep -cF -- "${err_bound#* }" "$d/run.err")" -gt "${err_bound%% *}" ]; then
      verdict="FAIL (stderr has $(grep -cF -- "${err_bound#* }" "$d/run.err") lines with '${err_bound#* }', at most ${err_bound%% *})"
    elif [ -n "$max_rss" ] && [ "$rss" -gt "$max_rss" ]; then
      verdict="FAIL (peak RSS ${rss} MB > ${max_rss} MB)"
    fi
    [ "$verdict" = PASS ] || rc=1
  fi
  echo "probe $n: $verdict"
  echo "::endgroup::"
  rows+=("| $n | $verdict | $size | $rss |"); printf '%s\t%s\n' "$n" "$verdict" >> "$ran"
done

{
  echo "### wasi probes (wasip1, wasmtime \`$flags\`)"
  echo "| probe | result | module bytes | peak RSS MB |"
  echo "|---|---|---|---|"
  printf '%s\n' "${rows[@]}"
} | tee -a "$summary"
exit $rc
