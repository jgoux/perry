#!/usr/bin/env bash
# Checks that the wasi-linux shards between them ran every expected probe and sjlj cell
# exactly once, and that none failed.
# usage: wasi-verify.sh <dir with one subdirectory of records per shard>
# Environment: EXPECTED_PROBES, EXPECTED_SJLJ (space-separated, from the plan job)
set -uo pipefail
dir=${1:?records dir}
rc=0
summary=${GITHUB_STEP_SUMMARY:-/dev/null}

probes=$(cat "$dir"/*/wasi-probes.ran 2>/dev/null | sort || true)
cells=$(cat "$dir"/*/sjlj-size.ran 2>/dev/null | sort || true)
want_probes=$(tr ' ' '\n' <<< "${EXPECTED_PROBES:-}" | sed '/^$/d' | sort)
want_cells=$(tr ' ' '\n' <<< "${EXPECTED_SJLJ:-}" | sed '/^$/d' | sort)
got_probes=$(cut -f1 <<< "$probes" | sed '/^$/d')
got_cells=$(sed '/^$/d' <<< "$cells")

check() { # <label> <want> <got>
  local dups missing extra
  dups=$(sort <<< "$3" | uniq -d); missing=$(comm -23 <(sort -u <<< "$2") <(sort -u <<< "$3")); extra=$(comm -13 <(sort -u <<< "$2") <(sort -u <<< "$3"))
  [ -z "$dups" ] || { echo "::error::$1 run more than once: $(tr '\n' ' ' <<< "$dups")"; rc=1; }
  [ -z "$missing" ] || { echo "::error::$1 never run: $(tr '\n' ' ' <<< "$missing")"; rc=1; }
  [ -z "$extra" ] || { echo "::error::$1 run but not expected: $(tr '\n' ' ' <<< "$extra")"; rc=1; }
  echo "$1: expected $(sed '/^$/d' <<< "$2" | wc -l | tr -d ' '), ran $(sed '/^$/d' <<< "$3" | wc -l | tr -d ' ')"
}
check probes "$want_probes" "$got_probes"
check "sjlj cells" "$want_cells" "$got_cells"

# MISSING is an `optional:` probe that does not compile yet; anything else but PASS is a failure.
bad=$(awk -F'\t' '$2 !~ /^PASS/ && $2 !~ /^MISSING/' <<< "$probes")
[ -z "$bad" ] || { echo "::error::probes that did not pass:"; echo "$bad"; rc=1; }
{
  echo "### wasi-verify"
  echo "- probes: $(sed '/^$/d' <<< "$got_probes" | wc -l | tr -d ' ') of $(sed '/^$/d' <<< "$want_probes" | wc -l | tr -d ' ') ran exactly once, $(awk -F'\t' '$2 ~ /^PASS/' <<< "$probes" | wc -l | tr -d ' ') PASS"
  echo "- sjlj cells: $(sed '/^$/d' <<< "$got_cells" | wc -l | tr -d ' ') of $(sed '/^$/d' <<< "$want_cells" | wc -l | tr -d ' ')"
} >> "$summary"
exit $rc
