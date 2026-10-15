//! Regression: two modules that each use the shared `linkonce_odr` helpers
//! (`perry_birth_class`, `perry_birth_empty_array`,
//! `perry_array_index_normalize_i32`) failed to link under codegen-unit
//! splitting with `duplicate symbol '_perry_birth_class'` (and the other two).
//!
//! Root cause: on the in-process native path every unit defines the helpers it
//! uses, and `LlFunction::define_header(true)` (the unit-promotion renderer)
//! dropped the linkage keyword entirely. That is right for `internal`/`private`
//! definitions, but it also turned the helpers' `linkonce_odr` into a plain
//! strong external definition, so each unit's copy collided at link time. The
//! promotion now keeps them coalescing (`weak_odr`).

use std::path::{Path, PathBuf};
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

fn write(root: &Path, name: &str, src: &str) {
    std::fs::write(root.join(name), src).expect("write source");
}

#[test]
fn shared_linkonce_helpers_coalesce_across_codegen_units() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    write(
        root,
        "a.ts",
        r#"export class Pt { x: number; y: number; constructor(x: number, y: number) { this.x = x; this.y = y; } }
export function fa(n: number): number {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(new Pt(i, i).x);
  return out.length + (out[n - 1] || 0);
}
export function fa2(n: number): number { return new Pt(n, 1).y + [].length; }
"#,
    );
    write(
        root,
        "b.ts",
        r#"export class Qt { a: number; b: number; constructor(a: number, b: number) { this.a = a; this.b = b; } }
export function fb(n: number): number {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(new Qt(i, i).a);
  return out.length + (out[n - 1] || 0);
}
export function fb2(n: number): number { return new Qt(n, 1).b + [].length; }
"#,
    );
    let entry = root.join("main.ts");
    write(
        root,
        "main.ts",
        r#"import { fa, fa2 } from "./a";
import { fb, fb2 } from "./b";
console.log(fa(5), fa2(3), fb(7), fb2(4));
"#,
    );

    let output = root.join("main_bin");
    let compile = Command::new(perry_bin())
        .current_dir(root)
        .arg("compile")
        .arg(&entry)
        .arg("-o")
        .arg(&output)
        .arg("--no-cache")
        .env("PERRY_NO_AUTO_OPTIMIZE", "1")
        .env("PERRY_CODEGEN_UNITS", "2")
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
        "compiled binary failed\nstderr:\n{}",
        String::from_utf8_lossy(&run.stderr)
    );
    assert_eq!(String::from_utf8_lossy(&run.stdout), "9 1 13 1\n");
}
