//! Regression: a class extending `http.Agent` through a local alias
//! (`const OriginalAgent = require('http').Agent`, agentkeepalive's shape)
//! must stay an instance of the subclass. `super(options)` ran the bound
//! export as an ordinary call; that built a native agent handle which `new`
//! then returned instead of the subclass instance, so the subclass lost its
//! own methods and field writes (`getCurrentStatus` read back `undefined`,
//! which crashed Storage's agent metrics timer).

use std::path::PathBuf;
use std::process::Command;

fn perry_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_perry"))
}

#[test]
fn two_level_subclass_of_aliased_http_agent_keeps_methods_and_fields() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    let entry = root.join("main.js");
    std::fs::write(
        &entry,
        "const OriginalAgent = require('http').Agent;\n\
         class A extends OriginalAgent {\n\
           constructor(o) { super(o); this.n = 1; }\n\
           getCurrentStatus() { return { n: this.n, sockets: Object.keys(this.sockets).length }; }\n\
         }\n\
         class B extends A {\n\
           constructor(o) { super(o); this.protocol = 'https:'; }\n\
         }\n\
         const b = new B({ keepAlive: true, maxSockets: 5 });\n\
         console.log(typeof b.getCurrentStatus, JSON.stringify(b.getCurrentStatus()), b.protocol, b.maxSockets);\n",
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
        "compiled binary failed\nstatus: {:?}\nstdout:\n{}\nstderr:\n{}",
        run.status,
        String::from_utf8_lossy(&run.stdout),
        String::from_utf8_lossy(&run.stderr)
    );
    assert_eq!(
        String::from_utf8_lossy(&run.stdout),
        "function {\"n\":1,\"sockets\":0} https: 5\n"
    );
}
