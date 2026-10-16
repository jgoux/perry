#!/usr/bin/env bash
# Regression tests added on this branch, built with the perry-dev profile (no LTO,
# 16 codegen units; the release profile compiles the big crates serially). `build` compiles every test binary in
# two cargo invocations (the perry crate needs its own feature set), `run`
# executes them. Both take the same selection so cargo reuses the build.
set -euo pipefail
cd "$(dirname "$0")/../.."

perry_tests=(
  --test cjs_class_method_sees_later_const
  --test class_computed_member_before_super_method
  --test codegen_units_shared_helper_linkage
  --test image_string_literal_native_args
  --test layout_family_alias_stack_map
  --test url_search_params_type_erased_methods
  --test worker_program_regex_literal
)
hir_tests=(--test cjs_factory_frame_label --test enum_as_value_lowering)
perry=(cargo test --locked --profile perry-dev -p perry --no-default-features --features compile-cli "${perry_tests[@]}")
rest=(cargo test --locked --profile perry-dev -p perry-hir -p perry-runtime -p perry-codegen --lib "${hir_tests[@]}")

case "${1:?build|run}" in
  build)
    "${perry[@]}" --no-run
    "${rest[@]}" --no-run
    ;;
  run)
    "${perry[@]}"
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
      non_elf_startup_registration_keeps_global_ctors
    )
    out=$(mktemp)
    RUST_TEST_THREADS=1 "${rest[@]}" -- "${names[@]}" 2>&1 | tee "$out"
    # A filter that matches nothing still reports success: insist on each name.
    for n in "${names[@]}"; do
      grep -Eq "^test .*${n} \.\.\. ok$" "$out" || { echo "::error::regression test $n did not run and pass"; exit 1; }
    done
    ;;
esac
