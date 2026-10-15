//! Regression: string literals passed to runtime natives that validate their
//! string argument (`URLSearchParams` get/has/append and the constructor
//! init) read as the empty string, so `new URLSearchParams('a=b&c=d').get('a')`
//! was `null` and `append('e', 'f')` appended an empty pair.
//!
//! Program string literals are immutable image strings in the
//! `__perry_strings` section. Their `GcHeader.size` covers the bytes rounded up
//! to 8 plus the trailing property-atom hash (`string_pool/image.rs`,
//! `property_atom_hash`), but the validator that admits image strings
//! (`value/addr_class/image.rs`) still required the unpadded, hash-less size,
//! so it refused every literal. Natives that skip the validator (console.log,
//! string concatenation) kept working, which hid the mismatch.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn literal_arguments_reach_validating_natives() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let entry = root.join("main.ts");
    std::fs::write(
        &entry,
        r#"const sp = new URLSearchParams('a=b&c=d');
console.log(sp.get('a'), sp.has('c'), sp.has('zz'));
sp.append('e', 'f');
console.log(sp.toString());
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
        "b true false\na=b&c=d&e=f\n"
    );
}
