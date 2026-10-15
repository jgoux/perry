//! Regression: methods of a `URLSearchParams` reached through a type-erased
//! receiver were `undefined`, so pg-connection-string's
//! `result.searchParams.entries()` threw "entries is not a function" (hit by
//! `pg.Client` with a `connectionString`).
//!
//! The runtime resolves URLSearchParams methods dynamically from a shape probe
//! that the slow named-read path only runs for non-ordinary receivers. Since the
//! runtime layouts were declared (`URL_SEARCH_PARAMS` in runtime_layouts.rs) a
//! native URLSearchParams is born plain ordinary like any record, so the gate
//! classified it as ordinary and skipped the probe. Statically typed receivers
//! (`new URL(..).searchParams`, a `const` initialised from `new URL`) never
//! reached the dynamic path, which is why simple programs kept working.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn type_erased_url_search_params_methods_are_callable() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let entry = root.join("main.js");
    std::fs::write(
        &entry,
        r#"'use strict';
function parse(str) {
  const config = Object.create(null);
  let result;
  try {
    result = new URL(str, 'postgres://base');
  } catch (e) {
    throw e;
  }
  for (const entry of result.searchParams.entries()) {
    config[entry[0]] = entry[1];
  }
  return config;
}
console.log(JSON.stringify(parse('postgres://u:p@h:1/db?sslmode=disable&x=1')));
const erased = [new URLSearchParams('a=b')][0];
console.log(typeof erased.get, erased.get('a'));
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
        "{\"sslmode\":\"disable\",\"x\":\"1\"}\nfunction b\n"
    );
}
