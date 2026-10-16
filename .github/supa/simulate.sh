#!/usr/bin/env bash
# Measurement aid for workflow_dispatch: touch one source file in the checkout
# so the hash-keyed caches see a change of that kind, without a commit.
set -euo pipefail
case "${1:-none}" in
  none) ;;
  link)    f=crates/perry/src/commands/compile/link/platform_cmd.rs ;;
  runtime) f=crates/perry-runtime/src/lib.rs ;;
  codegen) f=crates/perry-codegen/src/lib.rs ;;
  *) echo "unknown simulate kind: $1" >&2; exit 1 ;;
esac
[ -n "${f:-}" ] || exit 0
printf '\n// ci-simulated change\n' >> "$f"
echo "simulated a $1 change in $f"
