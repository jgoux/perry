//! Regression: tagged-template call sites in different modules must not share
//! a template object. Modules outside the entry file's directory (every
//! `node_modules` dependency of a `dist/start/*.js` entry) were lowered under
//! their bare file name, so two `index.js` files salted their call-site ids
//! identically; the first tagged template of each module then collided and the
//! second module's tag received the first module's strings. In Storage that
//! turned ajv's `_`!${x}`` into the strings of its parameter destructuring
//! (`{`, `="", `), producing invalid generated validator source.

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn first_tagged_template_of_same_named_modules_outside_the_entry_dir_stays_distinct() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    std::fs::write(
        root.join("package.json"),
        r#"{ "name": "app", "type": "module" }"#,
    )
    .expect("write package.json");
    for (name, text) in [("a", "alpha"), ("b", "beta")] {
        let lib = root.join("lib").join(name);
        std::fs::create_dir_all(&lib).expect("create lib dir");
        std::fs::write(
            lib.join("index.js"),
            format!(
                "function tag (strings, ...values) {{ return strings.join('|') + '#' + values.join(',') }}\n\
                 export const out = tag`{text}-${{1}}-end`\n"
            ),
        )
        .expect("write lib");
    }
    let src = root.join("src");
    std::fs::create_dir_all(&src).expect("create src dir");
    let entry = src.join("main.js");
    std::fs::write(
        &entry,
        "import { out as a } from '../lib/a/index.js'\n\
         import { out as b } from '../lib/b/index.js'\n\
         console.log(a)\n\
         console.log(b)\n",
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
        "alpha-|-end#1\nbeta-|-end#1\n"
    );
}
