//! `new <undici namespace>.Agent(...)` must lower to the native undici
//! constructor row, as the bare `new Agent(...)` import already does.
//!
//! Root cause: only the bare-identifier form (`import { Agent } from "undici"`)
//! was routed to the `undici` dispatch rows. esbuild's CommonJS output
//! (`var import_undici = require("undici"); new import_undici.Agent(...)`,
//! Supabase Storage's cdn-cache-manager) and `import * as undici` reached the
//! generic dynamic `new` on the module's `Agent` property, which is not a
//! constructor: module init threw "undefined is not a constructor".

use perry_diagnostics::SourceCache;
use perry_hir::lower_module;
use perry_parser::parse_typescript_with_cache;

fn lower_debug(src: &str) -> String {
    let src = src.to_string();
    std::thread::Builder::new()
        .stack_size(32 * 1024 * 1024)
        .spawn(move || {
            let mut cache = SourceCache::new();
            let parsed = parse_typescript_with_cache(
                &src,
                "undici_namespace_agent_construction.js",
                &mut cache,
            )
            .expect("parse should succeed");
            let module = lower_module(
                &parsed.module,
                "test",
                "undici_namespace_agent_construction.js",
            )
            .expect("lowering should succeed");
            format!("{module:#?}")
        })
        .expect("spawn lower thread")
        .join()
        .expect("lower thread panicked")
}

#[test]
fn undici_namespace_agent_construction_uses_the_native_constructor() {
    let cases = [
        (
            "require namespace",
            r#"var import_undici = require("undici");
               const dispatcher = new import_undici.Agent({ keepAliveTimeout: 1000 });
               console.log(typeof dispatcher);"#,
        ),
        (
            "import * namespace",
            r#"import * as undici from "undici";
               const dispatcher = new undici.Agent({ keepAliveTimeout: 1000 });
               console.log(typeof dispatcher);"#,
        ),
        (
            "ProxyAgent",
            r#"var u = require("undici");
               const dispatcher = new u.ProxyAgent("http://127.0.0.1:1");
               console.log(typeof dispatcher);"#,
        ),
    ];
    for (label, src) in cases {
        let debug = lower_debug(src);
        assert!(
            debug.contains("module: \"undici\""),
            "{label}: expected the undici native constructor row:\n{debug}"
        );
        assert!(
            !debug.contains("NewDynamic"),
            "{label}: must not fall back to a dynamic `new` on the module property:\n{debug}"
        );
    }
}
