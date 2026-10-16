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
cat > gdbcmds <<'G'
set pagination off
break _Unwind_RaiseException
run
bt 12
info symbol $pc
x/12i $pc
finish
p/x $x0
G
echo "== gdb =="; gdb -batch -x gdbcmds ./eh-uncaught.bin 2>&1 | tail -60
