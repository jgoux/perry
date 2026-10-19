#!/usr/bin/env bash
# Regression tests added on this branch, built with the perry-dev profile (no LTO,
# 16 codegen units; the release profile compiles the big crates serially). `build` compiles every test binary in
# two cargo invocations (the perry crate needs its own feature set), `run`
# executes them. Both take the same selection so cargo reuses the build.
set -euo pipefail
cd "$(dirname "$0")/../.."

perry_tests=(
  --test cjs_class_method_sees_later_const
  --test cjs_require_esm_package_namespace
  --test class_computed_member_before_super_method
  --test codegen_units_shared_helper_linkage
  --test http_agent_subclass_keeps_its_own_surface
  --test image_string_literal_native_args
  --test incoming_message_pipe
  --test layout_family_alias_stack_map
  --test pipeline_into_fs_write_stream
  --test tagged_template_sites_outside_entry_dir
  --test trace_throw_reports_origin
  --test url_search_params_type_erased_methods
  --test worker_program_regex_literal
)
hir_tests=(--test cjs_factory_frame_label --test enum_as_value_lowering --test undici_namespace_agent_construction)
perry=(cargo test --locked --profile perry-dev -p perry --no-default-features --features compile-cli "${perry_tests[@]}")
# The audit that every PERRY_* variable the compiler reads is a build-cache input (COMPILE_ENV_VARS in
# compile_env.rs): it fails on a read that is neither registered nor excluded with a reason. Same
# feature set and profile as the integration tests, so `build` compiles the bin's test target in the
# same invocation; `run` selects the audit alone (the bin has many other unit tests).
audit=(cargo test --locked --profile perry-dev -p perry --no-default-features --features compile-cli --bin perry)
# The whole perry-hir lib suite (cheap, ~700 tests): the substring-filtered names below only pin
# individual tests, so a lib test that rots after an upstream change would otherwise go unnoticed.
hir_lib=(cargo test --locked --profile perry-dev -p perry-hir --lib)
rest=(cargo test --locked --profile perry-dev -p perry-hir -p perry-runtime -p perry-codegen --lib "${hir_tests[@]}")

case "${1:?build|run}" in
  build)
    "${perry[@]}" --bin perry --no-run
    "${rest[@]}" --no-run
    "${hir_lib[@]}" --no-run
    ;;
  run)
    "${perry[@]}"
    audit_out=$(mktemp)
    "${audit[@]}" compile_env::tests::codegen_env_vars_are_build_cache_inputs 2>&1 | tee "$audit_out"
    grep -Eq '^test commands::compile::compile_env::tests::codegen_env_vars_are_build_cache_inputs \.\.\. ok$' "$audit_out" \
      || { echo "::error::the compile_env audit did not run and pass"; exit 1; }
    hir_out=$(mktemp)
    "${hir_lib[@]}" 2>&1 | tee "$hir_out"
    # A suite that compiled to zero tests also reports success: insist on a real count.
    grep -Eq '^test result: ok\. [1-9][0-9]* passed; 0 failed' "$hir_out" \
      || { echo "::error::the perry-hir lib suite did not run and pass"; exit 1; }
    # Substring filters; the exact function names matter because other
    # perry-codegen lib tests abort on this baseline. The hot-TLS test builds
    # IR for an explicit Apple triple, so it runs on Linux. The runtime tests
    # share process-wide GC state: one thread.
    names=(
      a_module_body_frame_renders_its_own_location
      tracked_classifier_rejects_null_forged_and_image_edge_addresses
      the_cap_does_not_count_groups_that_never_walk
      the_cap_counts_root_loads_not_derived_values
      the_hot_cache_read_is_marked_gc_leaf_in_bodies_without_root_slots
      the_module_body_frame_is_labelled_with_the_module_path
      bare_enum_identifier_materializes_the_enum_object
      elf_startup_registration_lands_in_init_array
      inline_cache_reads_native_alias_state_without_caching_a_miss
      the_census_is_unarmed_by_default
      non_elf_startup_registration_keeps_global_ctors
    )
    out=$(mktemp)
    RUST_TEST_THREADS=1 "${rest[@]}" -- "${names[@]}" 2>&1 | tee "$out"
    # A filter that matches nothing still reports success: insist on each name.
    for n in "${names[@]}"; do
      grep -Eq "^test .*${n} \.\.\. ok$" "$out" || { echo "::error::regression test $n did not run and pass"; exit 1; }
    done
    # The buffer backing tests assert exact live-backing counts and the B4
    # sabotage witness re-runs sibling tests in child processes. They must hold
    # under the default parallel harness, which is how they flaked before the
    # counts were isolated per test, so run them that way, repeatedly.
    buffer_names=(
      transfer_receiver_uses_original_pointer_after_sender_gc
      backing_outlives_its_allocating_worker
      each_compatible_b4_sabotage_turns_its_witness_red
    )
    for round in 1 2 3 4 5 6 7 8 9 10; do
      "${rest[@]}" -- buffer 2>&1 | tee "$out"
      for n in "${buffer_names[@]}"; do
        grep -Eq "^test .*${n} \.\.\. ok$" "$out" || { echo "::error::buffer test $n did not run and pass (round $round)"; exit 1; }
      done
    done
    ;;
esac
