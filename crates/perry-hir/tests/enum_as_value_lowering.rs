// A TypeScript enum used as a VALUE (`Object.values(E)`, `const e = E`) must
// lower to a materialized object, not to an unresolved-global lookup that
// throws `ReferenceError: E is not defined` at runtime. Enum member access
// (`E.A`) is folded at compile time and no binding named `E` exists at
// runtime, so the bare identifier has to carry the object itself.

use perry_diagnostics::SourceCache;
use perry_hir::{lower_module, Module};
use perry_parser::parse_typescript_with_cache;

fn lower_result(src: &str) -> Module {
    let src = src.to_string();
    std::thread::Builder::new()
        .stack_size(32 * 1024 * 1024)
        .spawn(move || {
            let mut cache = SourceCache::new();
            let parsed = parse_typescript_with_cache(&src, "enum_as_value.ts", &mut cache)
                .expect("parse should succeed");
            lower_module(&parsed.module, "test", "enum_as_value.ts")
                .expect("lowering should succeed")
        })
        .expect("spawn lower thread")
        .join()
        .expect("lower thread panicked")
}

fn init_debug(module: &Module) -> String {
    format!("{:?}", module.init)
}

#[test]
fn bare_enum_identifier_materializes_the_enum_object() {
    let module = lower_result(
        r#"
        export enum ErrorCode { NotFound = 'not_found', Gone = 'gone' }
        export enum Level { Low, High }
        export const codes = Object.values(ErrorCode);
        export const keys = Object.keys(Level);
        export const alias = Level;
        "#,
    );
    let dbg = init_debug(&module);
    assert!(
        !dbg.contains("js_global_get_or_throw_unresolved"),
        "bare enum identifier must not lower to an unresolved-global lookup: {dbg}"
    );
    // String members carry no reverse entry, numeric members do.
    assert!(dbg.contains("not_found"), "{dbg}");
    assert!(dbg.contains("\"High\""), "{dbg}");
}
