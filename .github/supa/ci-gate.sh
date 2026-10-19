#!/usr/bin/env bash
# The last job of the supa-storage workflow: every job the plan selected must have succeeded and
# every job it did not select must have been skipped. A job that a failed or skipped dependency
# silently skipped therefore fails the run, instead of leaving it green.
# Environment: NEEDS (toJSON(needs)), PLAN_* (the plan job's outputs: see ci-plan.sh)
set -uo pipefail
rc=0
res() { jq -r --arg j "$1" '.[$j].result // "absent"' <<< "$NEEDS"; }
# expect <job> <true|false>: success when selected, skipped when not
expect() {
  local r; r=$(res "$1")
  if [ "$2" = true ]; then
    [ "$r" = success ] || { echo "::error::$1 was selected but its result is '$r'"; rc=1; }
  else
    [ "$r" = skipped ] || { echo "::error::$1 was not selected but its result is '$r'"; rc=1; }
  fi
  printf '%-26s selected=%-5s result=%s\n' "$1" "$2" "$r"
}
# A job that the module cache replaces: success when it ran, skipped only on a cache hit.
expect_unless_hit() { # <job> <hit output> <selected>
  local r hit; r=$(res "$1"); hit=$(jq -r --arg o "$2" '.["storage-wasi-cache"].outputs[$o] // ""' <<< "$NEEDS")
  if [ "$3" != true ]; then expect "$1" false; return; fi
  if [ "$hit" = true ]; then
    [ "$r" = skipped ] || { echo "::error::$1 should be skipped on a cache hit but its result is '$r'"; rc=1; }
  else
    [ "$r" = success ] || { echo "::error::$1 should have run (cache miss) but its result is '$r'"; rc=1; }
  fi
  printf '%-26s selected=%-5s cache-hit=%-5s result=%s\n' "$1" "$3" "${hit:-false}" "$r"
}
expect plan true
expect build-perry "$PLAN_BUILD_PERRY"
expect regressions-linux "$PLAN_REGRESSIONS"
expect wasi-setup "$PLAN_WASI_SETUP"
expect wasi-linux "$PLAN_WASI"
expect wasi-verify "$PLAN_WASI"
expect wasi-artifacts "$PLAN_WASI"
expect storage-prep "$PLAN_STORAGE_PREP"
expect storage-wasi-cache "$PLAN_STORAGE_WASI"
expect_unless_hit storage-wasi hit "$PLAN_STORAGE_WASI"
expect_unless_hit storage-wasi-renderers render_hit "$PLAN_STORAGE_WASI"
expect storage-wasi-smoke "$PLAN_STORAGE_WASI"
expect storage-linux "$PLAN_STORAGE"
expect probes-linux "$PLAN_PROBES"
exit $rc
