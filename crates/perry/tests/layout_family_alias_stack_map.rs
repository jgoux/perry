//! Regression: a module with GC safepoints and a literal family that gains a
//! property after birth failed codegen with "unrecognised directive
//! `.alt_entry` inside the stack-map block" (hit by ajv's jtd-schema.js).
//!
//! The family's layout descriptor exports an `internal alias` of its
//! `layout_id` word. On Mach-O LLVM assembles an alias to `sym+offset` as
//! `.alt_entry <alias>` followed by an assignment, emitted after the module's
//! stack-map block. The stack-map rewriter (gc_map.rs) refuses any directive it
//! does not know the byte width of, and `.alt_entry` (zero bytes) was missing
//! from its zero-width list.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn family_layout_alias_with_stack_map_compiles_and_runs() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let entry = root.join("main.ts");
    std::fs::write(
        &entry,
        r#"const shared = (root: boolean) => {
  const sch: any = { nullable: { type: "boolean" } };
  if (root) sch.definitions = { values: 1 };
  return sch;
};
const form = (root: boolean) => ({ optionalProperties: shared(root) });
console.log(JSON.stringify([form(true), form(false)]));
"#,
    )
    .expect("write entry");

    let output = root.join("main_bin");
    let compile = Command::new(perry_bin())
        .current_dir(root)
        .arg("compile")
        .arg(&entry)
        .arg("-o")
        .arg(&output)
        .arg("--no-cache")
        .env("PERRY_NO_AUTO_OPTIMIZE", "1")
        .output()
        .expect("run perry compile");
    assert!(
        compile.status.success(),
        "perry compile failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&compile.stdout),
        String::from_utf8_lossy(&compile.stderr)
    );

    let run = Command::new(&output).output().expect("run compiled binary");
    assert!(
        run.status.success(),
        "compiled binary failed\nruntime stdout:\n{}\nruntime stderr:\n{}",
        String::from_utf8_lossy(&run.stdout),
        String::from_utf8_lossy(&run.stderr)
    );
    assert_eq!(
        String::from_utf8_lossy(&run.stdout),
        "[{\"optionalProperties\":{\"nullable\":{\"type\":\"boolean\"},\"definitions\":{\"values\":1}}},{\"optionalProperties\":{\"nullable\":{\"type\":\"boolean\"}}}]\n"
    );
}
