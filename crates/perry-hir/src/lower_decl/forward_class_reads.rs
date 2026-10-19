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
//! Once the body is lowered the binding is known. Those reads become reads of
//! the binding itself, captured the way a forward-captured `let`/`const` is: the
//! closure holds the binding's box, which the caller allocates ahead of the
//! closure (`PreallocateBoxes`) and the declaration's `Let` fills. Each
//! evaluation of the scope allocates its own box, so two evaluations (two calls
//! of a factory) keep two classes. Bodies without such a read are untouched.

use crate::ir::{Expr, Stmt};
use crate::types::{LocalId, Type};

/// Turn every forward `ClassRef(template)` read inside a closure of `body`
/// (statements before the declaration, the top-level `Let { id: binding }`)
/// into a read of `binding`, and capture `binding` by box in every closure on
/// the way to it. Returns whether anything changed; the caller then has to
/// allocate the binding's box ahead of the first closure.
pub(crate) fn capture_forward_class_reads(
    body: &mut [Stmt],
    template: &str,
    binding: LocalId,
) -> bool {
    let Some(decl_at) = body
        .iter()
        .position(|s| matches!(s, Stmt::Let { id, .. } if *id == binding))
    else {
        return false;
    };
    let mut redirect = Redirect {
        template,
        binding,
        in_closure: false,
        found: false,
    };
    redirect.stmts(&mut body[..decl_at]);
    redirect.found
}

struct Redirect<'a> {
    template: &'a str,
    binding: LocalId,
    in_closure: bool,
    found: bool,
}

impl Redirect<'_> {
    /// Visit `expr`; true when a read inside it was redirected.
    fn expr(&mut self, expr: &mut Expr) -> bool {
        match expr {
            Expr::ClassRef(name) if self.in_closure && name == self.template => {
                *expr = Expr::LocalGet(self.binding);
                self.found = true;
                true
            }
            // The declaration's own evaluation names the template on purpose.
            Expr::ClassExprFresh { .. } => false,
            Expr::Closure {
                body,
                params,
                captures,
                mutable_captures,
                ..
            } => {
                let outer = std::mem::replace(&mut self.in_closure, true);
                let mut hit = false;
                for p in params.iter_mut() {
                    if let Some(d) = &mut p.default {
                        hit |= self.expr(d);
                    }
                }
                hit |= self.stmts(body);
                self.in_closure = outer;
                if hit {
                    for list in [captures, mutable_captures] {
                        if !list.contains(&self.binding) {
                            list.push(self.binding);
                            list.sort();
                        }
                    }
                }
                hit
            }
            _ => {
                let mut hit = false;
                crate::walker::walk_expr_children_mut(expr, &mut |child| hit |= self.expr(child));
                hit
            }
        }
    }

    fn stmts(&mut self, stmts: &mut [Stmt]) -> bool {
        let mut hit = false;
        for s in stmts {
            hit |= self.stmt(s);
        }
        hit
    }

    fn opt_expr(&mut self, expr: &mut Option<Expr>) -> bool {
        expr.as_mut().is_some_and(|e| self.expr(e))
    }

    fn stmt(&mut self, stmt: &mut Stmt) -> bool {
        match stmt {
            Stmt::Let { init, .. } => self.opt_expr(init),
            Stmt::Expr(e) | Stmt::Throw(e) => self.expr(e),
            Stmt::Return(e) => self.opt_expr(e),
            Stmt::If {
                condition,
                then_branch,
                else_branch,
            } => {
                let mut hit = self.expr(condition);
                hit |= self.stmts(then_branch);
                if let Some(eb) = else_branch {
                    hit |= self.stmts(eb);
                }
                hit
            }
            Stmt::While { condition, body } | Stmt::DoWhile { body, condition } => {
                let mut hit = self.expr(condition);
                hit |= self.stmts(body);
                hit
            }
            Stmt::For {
                init,
                condition,
                update,
                body,
            } => {
                let mut hit = init.as_mut().is_some_and(|i| self.stmt(i));
                hit |= self.opt_expr(condition);
                hit |= self.opt_expr(update);
                hit |= self.stmts(body);
                hit
            }
            Stmt::Labeled { body, .. } => self.stmt(body),
            Stmt::Try {
                body,
                catch,
                finally,
            } => {
                let mut hit = self.stmts(body);
                if let Some(c) = catch {
                    hit |= self.stmts(&mut c.body);
                }
                if let Some(f) = finally {
                    hit |= self.stmts(f);
                }
                hit
            }
            Stmt::Switch {
                discriminant,
                cases,
            } => {
                let mut hit = self.expr(discriminant);
                for case in cases {
                    hit |= self.opt_expr(&mut case.test);
                    hit |= self.stmts(&mut case.body);
                }
                hit
            }
            Stmt::Break
            | Stmt::Continue
            | Stmt::LabeledBreak(_)
            | Stmt::LabeledContinue(_)
            | Stmt::PreallocateBoxes(_)
            | Stmt::PreallocateTdzBoxes(_)
            | Stmt::ReleaseBoxes(_) => false,
        }
    }
}
