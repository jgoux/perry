#!/usr/bin/env bash
# Source this in a step that runs the release cargo builds: `. .github/supa/ci-build-profile.sh <true|false>`.
#
# `true` is the fast-build mode of the iteration presets (ci-plan.sh decides when): the release
# profile with thin LTO off and 16 codegen units instead of Cargo.toml's `lto = "thin"` and
# `codegen-units = 1`, which compile perry-runtime on a single core. It is set through cargo's
# profile environment overrides only, so nothing else of the release profile changes:
# `panic = "abort"`, `opt-level = 3` and the package overrides stay as Cargo.toml has them, and
# `.cargo/config.toml`'s `-C force-unwind-tables=yes -Z use-sync-unwind=yes` stay in effect (the
# exception transport needs both; a RUSTFLAGS variable would replace that file, so the mode
# refuses to run with one). The package overrides in Cargo.toml (`codegen-units = 1` of the
# staticlib wrapper crates) win over the variable; those crates only archive the runtime rlib.
# `false` leaves the release profile exactly as it is.
#
# Sets FAST_BUILD_PROFILE to `fast` or `release` for the caller's summary.
if [ "${1:-false}" = true ]; then
  if [ -n "${RUSTFLAGS:-}${CARGO_ENCODED_RUSTFLAGS:-}" ]; then
    echo "::error::fast build: RUSTFLAGS would replace .cargo/config.toml (force-unwind-tables); refusing"
    return 1 2>/dev/null || exit 1
  fi
  export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
  export CARGO_PROFILE_RELEASE_LTO=off
  FAST_BUILD_PROFILE=fast
  # What cargo will actually build the runtime with (no compilation: --unit-graph): the exception
  # transport needs panic=abort next to the unwind tables, and the speed-up needs the override
  # to have taken effect.
  runtime=$(cargo build --locked --release -p perry-runtime-static --unit-graph -Z unstable-options 2>/dev/null \
    | jq -c '[.units[] | select(.target.name == "perry_runtime" and (.target.kind | index("rlib"))) | .profile
              | {panic, opt_level, lto, codegen_units}][0]')
  echo "fast build: perry_runtime rlib profile $runtime"
  jq -e '.panic == "abort" and .opt_level == "3" and .lto == "off" and .codegen_units == 16' <<< "$runtime" >/dev/null \
    || { echo "::error::fast build: perry_runtime does not get panic=abort, opt-level 3, lto off and 16 codegen units"; return 1 2>/dev/null || exit 1; }
else
  FAST_BUILD_PROFILE=release
fi
export FAST_BUILD_PROFILE
