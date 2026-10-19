#!/usr/bin/env bash
# Decides which jobs of the supa-storage workflow run, from the event, the branch and the
# dispatch inputs; prints `name=value` lines for $GITHUB_OUTPUT. Every job's `if:` reads these
# outputs and nothing else, and ci-gate.sh checks the finished run against them, so a
# dependency can not silently skip a job the selection needs.
#
# Selections (workflow_dispatch `preset`):
#   custom         the individual flags: storage, storage_wasi, wasi, probes, skip_regressions
#   unit           regressions-linux only: the runtime unit and integration tests
#   regress-wasi   regressions + wasi-linux (every probe, or wasi_probe_names only)
#   storage-wasi   Storage compiled to wasip1: module, renderers and the supa-host smoke
#   full           everything: the four above, storage-linux and probes-linux
# A push to supa/wasip1 selects wasi and storage-wasi besides what other pushes select
# (storage-linux, regressions); with `custom` so does a dispatch on that branch.
# skip_regressions removes regressions-linux from any selection.
#
# Build profile (`fast_build`: auto|on|off): the fast profile builds the compiler and the runtime
# archives without thin LTO and with 16 codegen units (ci-build-profile.sh), for iteration runs.
# auto means on for the presets `unit` and `regress-wasi`, off for everything else (full,
# storage-wasi, custom, pushes). Everything that measures or ships is built as a release: `on`
# is refused when storage or storage_wasi is selected, so a fast build never reaches the Storage
# module, the smoke or the storage-dist artifact. The profile is in every cache key that holds
# build output (the workflow derives them from the `fast_build` output).
#
# Environment: EVENT_NAME REF_NAME PRESET SKIP_REGRESSIONS STORAGE STORAGE_WASI WASI PROBES
#              WASI_PROBE_NAMES WASI_SHARDS FAST_BUILD
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${GITHUB_OUTPUT:-/dev/stdout}
t() { [ "${1:-}" = true ] && echo 1 || echo 0; }

regressions=0 storage=0 storage_wasi=0 wasi=0 probes=0
preset=${PRESET:-custom}
if [ "${EVENT_NAME:-}" != workflow_dispatch ]; then
  preset=custom
  regressions=1 storage=1
  [ "${REF_NAME:-}" = supa/wasip1 ] && { wasi=1; storage_wasi=1; }
else
  case "$preset" in
    custom)
      regressions=1
      storage=$(t "${STORAGE:-}"); storage_wasi=$(t "${STORAGE_WASI:-}"); wasi=$(t "${WASI:-}"); probes=$(t "${PROBES:-}")
      [ "${REF_NAME:-}" = supa/wasip1 ] && { wasi=1; storage_wasi=1; }
      ;;
    unit) regressions=1 ;;
    regress-wasi) regressions=1 wasi=1 ;;
    storage-wasi) storage_wasi=1 ;;
    full) regressions=1 storage=1 storage_wasi=1 wasi=1 probes=1 ;;
    *) echo "::error::unknown preset '$preset'"; exit 1 ;;
  esac
  [ "${SKIP_REGRESSIONS:-}" = true ] && regressions=0
fi

case "${FAST_BUILD:-auto}" in
  auto|'') case "$preset" in unit|regress-wasi) fast=1 ;; *) fast=0 ;; esac ;;
  on) fast=1 ;;
  off) fast=0 ;;
  *) echo "::error::unknown fast_build '${FAST_BUILD}' (auto, on or off)"; exit 1 ;;
esac
# A push selects storage (and never presets): its fast_build input is empty, so auto is off.
if [ "$fast" = 1 ] && [ "$(( storage || storage_wasi ))" = 1 ]; then
  echo "::error::fast_build=on with a Storage job selected (storage=$storage, storage_wasi=$storage_wasi): the Storage module, the smoke and storage-dist are release builds only; use fast_build=off or auto"
  exit 1
fi

b() { [ "$1" = 1 ] && echo true || echo false; }
build_perry=$(( regressions || wasi || storage_wasi || storage || probes ))
storage_prep=$(( storage || storage_wasi ))
wasi_setup=$(( wasi || storage_wasi ))

shards=$(python3 -I "$here/wasi-shards.py" "${WASI_SHARDS:-5}" ${WASI_PROBE_NAMES:-})
{
  echo "preset=$preset"
  echo "regressions=$(b $regressions)"
  echo "storage=$(b $storage)"
  echo "storage_wasi=$(b $storage_wasi)"
  echo "wasi=$(b $wasi)"
  echo "probes=$(b $probes)"
  echo "build_perry=$(b $build_perry)"
  echo "storage_prep=$(b $storage_prep)"
  echo "wasi_setup=$(b $wasi_setup)"
  echo "fast_build=$(b $fast)"
  echo "profile=$([ "$fast" = 1 ] && echo fast || echo release)"
  echo "wasi_matrix=$(jq -c .include <<< "$shards")"
  echo "wasi_probes=$(jq -r '.expected_probes | join(" ")' <<< "$shards")"
  echo "wasi_sjlj=$(jq -r '.expected_sjlj | join(" ")' <<< "$shards")"
} >> "$out"

{
  echo "### plan: \`$preset\`"
  echo "| job | runs |"
  echo "|---|---|"
  for j in regressions storage storage_wasi wasi probes; do echo "| $j | ${!j} |"; done
  echo
  echo "build profile: **$([ "$fast" = 1 ] && echo fast || echo release)** (fast_build=${FAST_BUILD:-auto})"
  echo
  echo "wasi shards:"
  echo '```'
  jq -r '.include[] | "shard \(.shard): \((.probes | split(" ") | length)) probes, sjlj: \(.sjlj)"' <<< "$shards"
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
