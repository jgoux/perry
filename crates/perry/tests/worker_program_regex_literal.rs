//! Regression: a regex literal in a program that also uses `new Worker` threw
//! "Invalid flags supplied to RegExp constructor" on first evaluation.
//!
//! Worker programs keep string handle globals in thread-local storage so each
//! agent owns its own string handles. The regex-literal site descriptor stored
//! the *address* of those globals, and in that mode a `ptr @global` names the
//! thread-local descriptor, not the calling agent's slot, so the runtime read
//! garbage as the pattern/flags strings. A literal site now names the module's
//! immutable static string descriptors instead, and the runtime builds the
//! pattern and flags from their bytes, which is valid in every agent.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn regex_literals_evaluate_in_a_worker_program() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    std::fs::write(root.join("w.ts"), "postMessage(1);\n").expect("write worker");
    let entry = root.join("main.ts");
    std::fs::write(
        &entry,
        r#"const worker = new Worker(new URL('./w.ts', import.meta.url));
const re = /^a(b+)c$/gi;
const re2 = /x\d+/u;
const tags = ['abbbc', 'ABC', 'x12'];
console.log(tags.map((t) => re.test(t) + ':' + re2.test(t)).join(','));
worker.terminate().then(() => process.exit(0));
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
        "true:false,false:false,false:true\n"
    );
}
