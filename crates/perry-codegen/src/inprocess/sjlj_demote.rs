//! Keep block-crossing SSA values out of the wasm setjmp dispatch (P55).
//!
//! LLVM lowers setjmp/longjmp on wasm (`-wasm-enable-sjlj`) by turning every
//! call of a function that calls `setjmp` into an `invoke` whose unwind edge
//! goes to ONE shared dispatch block, from which a longjmp re-enters the
//! function at the block after any `setjmp` call. Those re-entry edges break
//! dominance: a value defined in a block that no longer dominates its use gets
//! a phi at the dispatch block with one incoming value per `invoke`. The wasm
//! backend then demotes those phis to stack slots (`WinEHPrepare`), which is
//! one store per invoke per value: (calls x block-crossing values) stores, and
//! a try-heavy Storage module spent 181 MB of its 300 MB of code on them.
//!
//! The values need not be SSA across blocks at all. After the optimizer has
//! run, this pass moves every value that is used outside its defining block
//! (or across a `setjmp` call inside it) into a stack slot of its own: one
//! store after the definition and one load before each such use, so the cost
//! is linear in the function. Nothing is left for the lowering to repair, and
//! the semantics are SSA's: a longjmp re-entry reads the slot, which holds the
//! value of the latest execution of the definition, exactly what the phi
//! carried.
//!
//! It must run after the optimizer (which would promote the slots straight
//! back to SSA) and only on wasm32, whose lowering is the one that pays for
//! SSA values across the dispatch. Perry roots GC values through shadow-frame
//! slots and reloads them after every collection point, so no SSA value is
//! relied on across a collection and a plain slot is as good a home as a wasm
//! local was.
//!
//! Only reached through the in-process backend (the default for wasm); the
//! `clang` text path keeps the larger code. `PERRY_WASM_SJLJ_DEMOTE=0`
//! disables it, for before/after measurements.

use std::collections::{HashMap, HashSet};

use inkwell::module::Module;
use llvm_sys::{core::*, prelude::*, LLVMOpcode, LLVMTypeKind};

/// What one module needed.
#[derive(Debug, Default, PartialEq, Eq)]
pub(super) struct DemoteStats {
    /// setjmp functions that were rewritten.
    pub(super) functions: usize,
    /// Values given a stack slot.
    pub(super) values: usize,
}

pub(super) fn enabled() -> bool {
    !matches!(
        std::env::var("PERRY_WASM_SJLJ_DEMOTE").as_deref(),
        Ok("0" | "off" | "false")
    )
}

/// Demote the block-crossing values of every function of `module` that calls
/// `setjmp`. The caller verifies the module afterwards.
pub(super) fn apply(module: &Module<'_>) -> DemoteStats {
    let mut stats = DemoteStats::default();
    unsafe {
        let module = module.as_mut_ptr();
        let builder = LLVMCreateBuilderInContext(LLVMGetModuleContext(module));
        let mut function = LLVMGetFirstFunction(module);
        while !function.is_null() {
            if LLVMIsDeclaration(function) == 0 {
                let values = demote_function(builder, function);
                if values > 0 {
                    stats.functions += 1;
                    stats.values += values;
                }
            }
            function = LLVMGetNextFunction(function);
        }
        LLVMDisposeBuilder(builder);
    }
    stats
}

/// A position in the CFG as the sjlj lowering will see it: a block, and how
/// many `setjmp` calls of that block precede it. The code after a `setjmp`
/// call becomes a block of its own, re-entered by the dispatch, so a value
/// defined before the call does not dominate a use after it.
type Point = (LLVMBasicBlockRef, u32);

struct Layout {
    /// `setjmp` calls before each instruction of a block that has any (other
    /// blocks are all segment 0).
    segment: HashMap<LLVMValueRef, u32>,
    /// `setjmp` calls in each block that has any.
    setjmps: HashMap<LLVMBasicBlockRef, u32>,
}

impl Layout {
    unsafe fn point(&self, inst: LLVMValueRef) -> Point {
        (
            LLVMGetInstructionParent(inst),
            self.segment.get(&inst).copied().unwrap_or(0),
        )
    }

    /// Where a phi reads its incoming value: the end of the incoming block.
    fn end_of(&self, block: LLVMBasicBlockRef) -> Point {
        (block, self.setjmps.get(&block).copied().unwrap_or(0))
    }
}

/// One value to move to memory and the operands to read back from there.
struct Demotion {
    value: LLVMValueRef,
    /// (user, operand indexes) that cannot keep the SSA value.
    uses: Vec<(LLVMValueRef, Vec<u32>)>,
}

unsafe fn is_setjmp_call(inst: LLVMValueRef) -> bool {
    if LLVMGetInstructionOpcode(inst) != LLVMOpcode::LLVMCall {
        return false;
    }
    let callee = LLVMGetCalledValue(inst);
    if callee.is_null() || LLVMIsAFunction(callee).is_null() {
        return false;
    }
    let mut len: usize = 0;
    let name = LLVMGetValueName2(callee, &mut len);
    !name.is_null() && std::slice::from_raw_parts(name.cast::<u8>(), len) == b"setjmp"
}

/// Rewrite one function; returns how many values were demoted.
unsafe fn demote_function(builder: LLVMBuilderRef, function: LLVMValueRef) -> usize {
    let mut blocks = Vec::new();
    let mut block = LLVMGetFirstBasicBlock(function);
    while !block.is_null() {
        blocks.push(block);
        block = LLVMGetNextBasicBlock(block);
    }

    let mut layout = Layout {
        segment: HashMap::new(),
        setjmps: HashMap::new(),
    };
    for &block in &blocks {
        let mut count = 0u32;
        let mut inst = LLVMGetFirstInstruction(block);
        while !inst.is_null() {
            match LLVMGetInstructionOpcode(inst) {
                // Funclet and landing-pad EH is the native lowering's; a
                // function using it is not the shape this pass understands.
                LLVMOpcode::LLVMInvoke
                | LLVMOpcode::LLVMCallBr
                | LLVMOpcode::LLVMLandingPad
                | LLVMOpcode::LLVMResume
                | LLVMOpcode::LLVMCatchSwitch
                | LLVMOpcode::LLVMCatchPad
                | LLVMOpcode::LLVMCatchRet
                | LLVMOpcode::LLVMCleanupPad
                | LLVMOpcode::LLVMCleanupRet => return 0,
                _ => {}
            }
            if is_setjmp_call(inst) {
                count += 1;
            }
            inst = LLVMGetNextInstruction(inst);
        }
        if count > 0 {
            layout.setjmps.insert(block, count);
            let mut seen = 0u32;
            let mut inst = LLVMGetFirstInstruction(block);
            while !inst.is_null() {
                layout.segment.insert(inst, seen);
                if is_setjmp_call(inst) {
                    seen += 1;
                }
                inst = LLVMGetNextInstruction(inst);
            }
        }
    }
    if layout.setjmps.is_empty() {
        return 0;
    }

    let entry = LLVMGetEntryBasicBlock(function);
    hoist_static_allocas(builder, entry);

    // The entry block up to its first call dominates the whole function even
    // after the lowering splits the block at each call and adds re-entry
    // edges: nothing can unwind out of it.
    let mut dominating = HashSet::new();
    let mut inst = LLVMGetFirstInstruction(entry);
    while !inst.is_null() && LLVMGetInstructionOpcode(inst) != LLVMOpcode::LLVMCall {
        dominating.insert(inst);
        inst = LLVMGetNextInstruction(inst);
    }

    let mut demotions = Vec::new();
    for &block in &blocks {
        let mut inst = LLVMGetFirstInstruction(block);
        while !inst.is_null() {
            if let Some(demotion) = plan(&layout, &dominating, inst) {
                demotions.push(demotion);
            }
            inst = LLVMGetNextInstruction(inst);
        }
    }

    let empty = c"".as_ptr();
    for demotion in &demotions {
        let value = demotion.value;
        let ty = LLVMTypeOf(value);
        LLVMPositionBuilderBefore(builder, LLVMGetFirstInstruction(entry));
        let slot = LLVMBuildAlloca(builder, ty, empty);

        let mut after = LLVMGetNextInstruction(value);
        if !LLVMIsAPHINode(value).is_null() {
            // The store goes after the block's phis.
            after = LLVMGetFirstInstruction(LLVMGetInstructionParent(value));
            while !LLVMIsAPHINode(after).is_null() {
                after = LLVMGetNextInstruction(after);
            }
        }
        LLVMPositionBuilderBefore(builder, after);
        LLVMBuildStore(builder, value, slot);

        for (user, operands) in &demotion.uses {
            if !LLVMIsAPHINode(*user).is_null() {
                // One load per incoming block: a switch can reach a phi
                // through several entries, and they must agree.
                let mut loads: HashMap<LLVMBasicBlockRef, LLVMValueRef> = HashMap::new();
                for &index in operands {
                    let pred = LLVMGetIncomingBlock(*user, index);
                    let load = *loads.entry(pred).or_insert_with(|| {
                        LLVMPositionBuilderBefore(builder, LLVMGetBasicBlockTerminator(pred));
                        LLVMBuildLoad2(builder, ty, slot, empty)
                    });
                    LLVMSetOperand(*user, index, load);
                }
            } else {
                LLVMPositionBuilderBefore(builder, *user);
                let load = LLVMBuildLoad2(builder, ty, slot, empty);
                for &index in operands {
                    LLVMSetOperand(*user, index, load);
                }
            }
        }
    }
    demotions.len()
}

/// The uses of `inst` that need it in memory, if there are any.
unsafe fn plan(
    layout: &Layout,
    dominating: &HashSet<LLVMValueRef>,
    inst: LLVMValueRef,
) -> Option<Demotion> {
    let ty = LLVMTypeOf(inst);
    if LLVMGetTypeKind(ty) == LLVMTypeKind::LLVMVoidTypeKind
        || LLVMTypeIsSized(ty) == 0
        || dominating.contains(&inst)
        // A dynamic alloca keeps its SSA pointer (lifetime markers and the
        // like want the alloca itself); one value is no blowup.
        || LLVMGetInstructionOpcode(inst) == LLVMOpcode::LLVMAlloca
        // The lowering rewires the users of setjmp's result itself.
        || is_setjmp_call(inst)
    {
        return None;
    }
    let def = layout.point(inst);
    let mut users: Vec<LLVMValueRef> = Vec::new();
    let mut seen = HashSet::new();
    let mut use_ = LLVMGetFirstUse(inst);
    while !use_.is_null() {
        let user = LLVMGetUser(use_);
        if !LLVMIsAInstruction(user).is_null() && seen.insert(user) {
            users.push(user);
        }
        use_ = LLVMGetNextUse(use_);
    }

    let mut uses = Vec::new();
    for user in users {
        let mut operands = Vec::new();
        if !LLVMIsAPHINode(user).is_null() {
            for index in 0..LLVMCountIncoming(user) {
                if LLVMGetOperand(user, index) == inst
                    && layout.end_of(LLVMGetIncomingBlock(user, index)) != def
                {
                    operands.push(index);
                }
            }
        } else if layout.point(user) != def {
            for index in 0..LLVMGetNumOperands(user) as u32 {
                if LLVMGetOperand(user, index) == inst {
                    operands.push(index);
                }
            }
        }
        if !operands.is_empty() {
            uses.push((user, operands));
        }
    }
    (!uses.is_empty()).then_some(Demotion { value: inst, uses })
}

/// Put the entry block's constant-size allocas first, so they dominate
/// everything. Optimization normally leaves them there; this makes it a
/// guarantee the slot-sharing rules above can rely on.
unsafe fn hoist_static_allocas(builder: LLVMBuilderRef, entry: LLVMBasicBlockRef) {
    let mut leading = true;
    let mut misplaced = Vec::new();
    let mut inst = LLVMGetFirstInstruction(entry);
    while !inst.is_null() {
        let is_alloca = !LLVMIsAAllocaInst(inst).is_null();
        if is_alloca && !leading && !LLVMIsAConstantInt(LLVMGetOperand(inst, 0)).is_null() {
            misplaced.push(inst);
        }
        leading &= is_alloca;
        inst = LLVMGetNextInstruction(inst);
    }
    if misplaced.is_empty() {
        return;
    }
    let first = LLVMGetFirstInstruction(entry);
    for alloca in misplaced {
        LLVMInstructionRemoveFromParent(alloca);
        LLVMPositionBuilderBefore(builder, first);
        LLVMInsertIntoBuilder(builder, alloca);
    }
}
