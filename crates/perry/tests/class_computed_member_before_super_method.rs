//! Regression: a class declaration with a computed member followed by a method
//! that uses `super.x` failed to link with an undefined `..._eclo$info` symbol.
//!
//! Members after a generic computed member are registered in source order via
//! `js_register_class_computed_method`. That registration chose the explicit
//! method-owner entry (`<method>__eclo`) from `body_needs_method_owner`, but
//! the entry is only emitted when `body_needs_explicit_method_owner` holds
//! (a fresh class evaluation, not a plain class declaration), so the
//! registration referenced a symbol nobody defined.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn computed_member_before_super_method_links_and_runs() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let entry = root.join("main.ts");
    std::fs::write(
        &entry,
        r#"const key = 'dyn' + 'amic';
class Base {
  hello(x: number): string { return 'base:' + x; }
}
class Child extends Base {
  [key](): string { return 'computed'; }
  hello(x: number): string { return 'child>' + super.hello(x); }
}
const c: any = new Child();
console.log(c.dynamic(), c.hello(1));
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
    assert_eq!(String::from_utf8_lossy(&run.stdout), "computed child>base:1\n");
}
