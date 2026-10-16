#!/usr/bin/env bash
# Temporary: say where the uncaught-throw FATAL's garbage reason code comes from.
set -uo pipefail
d=${OUT:-$PWD/supa-out}/probes/eh-uncaught
b=$d/eh-uncaught.bin
cd "$d" || exit 0
echo "== file/ldd =="; file "$b"; ldd "$b"
echo "== dynamic unwind symbols =="; nm -D "$b" | grep -i unwind
echo "== static unwind symbols =="; nm "$b" | grep -i '_Unwind_RaiseException\|_Unwind_Find_FDE\|dl_iterate_phdr' | head
echo "== walker off =="; PERRY_EH_WALKER=off PERRY_EH_TRACE=1 ./eh-uncaught.bin 2>&1 | head -20
echo "== walker diff =="; PERRY_EH_WALKER=diff PERRY_EH_TRACE=1 ./eh-uncaught.bin 2>&1 | head -20
echo "== bindings =="; LD_DEBUG=bindings ./eh-uncaught.bin 2>&1 | grep -i 'unwind' | head
sudo apt-get install -y gdb >/dev/null 2>&1 || true
cat > gdbpy.py <<'G'
import gdb
gdb.execute('set pagination off')
gdb.execute('break _Unwind_RaiseException')
gdb.execute('run')
fr = gdb.selected_frame()
pc = int(fr.pc())
start = pc - 16
arch = fr.architecture()
func = gdb.execute('info symbol $pc', to_string=True)
print(func)
# every ret and every indirect branch inside the function body (bounded scan)
rets = []
addr = start
for _ in range(1200):
    ins = arch.disassemble(addr)[0]
    a, asm = ins['addr'], ins['asm']
    if asm.startswith('ret') or asm.startswith('br ') or asm.startswith('braa') or asm.startswith('retaa'):
        rets.append((a, asm))
    addr = a + ins['length']
print('rets/branches:', [(hex(a), s) for a, s in rets][:20])
for a, s in rets[:20]:
    gdb.execute('tbreak *%d' % a)
gdb.execute('continue')
print('stopped at', hex(int(gdb.selected_frame().pc())))
gdb.execute('info registers x0 x1 x19 x20 x30 sp')
gdb.execute('x/6i $pc-12')
gdb.execute('bt 6')
G
echo "== gdb =="; gdb -batch -x gdbpy.py ./eh-uncaught.bin 2>&1 | tail -60
