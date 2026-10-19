//! Forward reads of a per-evaluation class declaration.
//!
//! A class declaration that lowers to a `ClassExprFresh` binds its name to the
//! evaluated class object only from the declaration onward. A closure lowered
//! BEFORE the declaration (esbuild's `__export(exports, { C: () => C })`, which
//! precedes `class C extends Error`) resolves the name to `ClassRef(<template>)`
//! because no local exists yet, so it reads the shared template: a class value
//! whose `.prototype` is not the evaluation's, hence `new` through it builds
//! instances whose `constructor` and `instanceof` disagree with the binding.
//!
//! Once the body is lowered the binding is known. Those reads are redirected
//! through the class lexical-binding side table (`js_class_lexical_binding_get`
//! falls back to the class value until a binding is stored), and the
//! declaration stores its evaluated class there. Bodies without such a read are
//! left untouched.

use crate::ir::{Expr, Stmt};
use crate::types::{LocalId, Type};

const GET: &str = "js_class_lexical_binding_get";
const SET: &str = "js_class_lexical_binding_set";

fn bridge_call(name: &str, args: Vec<Expr>) -> Expr {
    Expr::Call {
        callee: Box::new(Expr::ExternFuncRef {
            name: name.to_string(),
            param_types: vec![Type::Any; args.len()],
            return_type: Type::Any,
        }),
        args,
        type_args: Vec::new(),
        byte_offset: 0,
    }
}

/// Redirect every forward `ClassRef(template)` read in `body` through the
/// lexical-binding table and make the declaration (the top-level
/// `Let { id: binding }`) store its evaluated class there. Returns whether
/// anything was redirected.
pub(crate) fn redirect_forward_class_reads(
    body: &mut Vec<Stmt>,
    template: &str,
    binding: LocalId,
) -> bool {
    let Some(decl_at) = body
        .iter()
        .position(|s| matches!(s, Stmt::Let { id, .. } if *id == binding))
    else {
        return false;
    };
    let mut redirected = false;
    for stmt in body.iter_mut() {
        redirect_stmt(stmt, template, &mut redirected);
    }
    if redirected {
        body.insert(
            decl_at + 1,
            Stmt::Expr(bridge_call(
                SET,
                vec![Expr::ClassRef(template.to_string()), Expr::LocalGet(binding)],
            )),
        );
    }
    redirected
}

fn redirect_expr(expr: &mut Expr, template: &str, redirected: &mut bool) {
    match expr {
        Expr::ClassRef(name) if name == template => {
            *expr = bridge_call(GET, vec![Expr::ClassRef(template.to_string())]);
            *redirected = true;
        }
        // The declaration's own evaluation and an existing bridge call name the
        // template on purpose.
        Expr::ClassExprFresh { .. } => {}
        Expr::Call { callee, .. }
            if matches!(
                callee.as_ref(),
                Expr::ExternFuncRef { name, .. } if name == GET || name == SET
            ) => {}
        Expr::Closure { body, params, .. } => {
            for p in params.iter_mut() {
                if let Some(d) = &mut p.default {
                    redirect_expr(d, template, redirected);
                }
            }
            for s in body.iter_mut() {
                redirect_stmt(s, template, redirected);
            }
        }
        _ => crate::walker::walk_expr_children_mut(expr, &mut |child| {
            redirect_expr(child, template, redirected)
        }),
    }
}

fn redirect_stmts(stmts: &mut [Stmt], template: &str, redirected: &mut bool) {
    for s in stmts {
        redirect_stmt(s, template, redirected);
    }
}

fn redirect_stmt(stmt: &mut Stmt, template: &str, redirected: &mut bool) {
    match stmt {
        Stmt::Let { init, .. } => {
            if let Some(e) = init {
                redirect_expr(e, template, redirected);
            }
        }
        Stmt::Expr(e) | Stmt::Throw(e) => redirect_expr(e, template, redirected),
        Stmt::Return(e) => {
            if let Some(e) = e {
                redirect_expr(e, template, redirected);
            }
        }
        Stmt::If {
            condition,
            then_branch,
            else_branch,
        } => {
            redirect_expr(condition, template, redirected);
            redirect_stmts(then_branch, template, redirected);
            if let Some(eb) = else_branch {
                redirect_stmts(eb, template, redirected);
            }
        }
        Stmt::While { condition, body } | Stmt::DoWhile { body, condition } => {
            redirect_expr(condition, template, redirected);
            redirect_stmts(body, template, redirected);
        }
        Stmt::For {
            init,
            condition,
            update,
            body,
        } => {
            if let Some(i) = init {
                redirect_stmt(i, template, redirected);
            }
            if let Some(c) = condition {
                redirect_expr(c, template, redirected);
            }
            if let Some(u) = update {
                redirect_expr(u, template, redirected);
            }
            redirect_stmts(body, template, redirected);
        }
        Stmt::Labeled { body, .. } => redirect_stmt(body, template, redirected),
        Stmt::Try {
            body,
            catch,
            finally,
        } => {
            redirect_stmts(body, template, redirected);
            if let Some(c) = catch {
                redirect_stmts(&mut c.body, template, redirected);
            }
            if let Some(f) = finally {
                redirect_stmts(f, template, redirected);
            }
        }
        Stmt::Switch {
            discriminant,
            cases,
        } => {
            redirect_expr(discriminant, template, redirected);
            for case in cases {
                if let Some(t) = &mut case.test {
                    redirect_expr(t, template, redirected);
                }
                redirect_stmts(&mut case.body, template, redirected);
            }
        }
        Stmt::Break
        | Stmt::Continue
        | Stmt::LabeledBreak(_)
        | Stmt::LabeledContinue(_)
        | Stmt::PreallocateBoxes(_)
        | Stmt::PreallocateTdzBoxes(_)
        | Stmt::ReleaseBoxes(_) => {}
    }
}
