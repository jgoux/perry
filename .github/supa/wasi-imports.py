#!/usr/bin/env python3
"""Import hygiene for a wasip1 module: print its imports and target features,
and fail if it imports anything the supa-wasm host does not provide.

usage: wasi-imports.py [--quiet] app.wasm

The host (supa-wasm, wasmtime 49) links a fixed preview1 subset, and an import
it lacks fails instantiation. The only other module a guest may import is
`supa_net`. Parsed straight from the binary so the check needs no tooling.
"""
import sys

PREVIEW1 = "wasi_snapshot_preview1"
HOST_MODULES = {"supa_net"}
# Everything the host links. Missing on purpose: clock_res_get, fd_datasync,
# fd_allocate, fd_fdstat_set_rights, proc_raise.
HOST_PREVIEW1 = {
    "args_get", "args_sizes_get", "environ_get", "environ_sizes_get",
    "clock_time_get", "fd_advise", "fd_close", "fd_fdstat_get",
    "fd_fdstat_set_flags", "fd_filestat_get", "fd_filestat_set_size",
    "fd_filestat_set_times", "fd_pread", "fd_pwrite", "fd_prestat_get",
    "fd_prestat_dir_name", "fd_read", "fd_readdir", "fd_renumber", "fd_seek",
    "fd_sync", "fd_tell", "fd_write", "path_create_directory",
    "path_filestat_get", "path_filestat_set_times", "path_link", "path_open",
    "path_readlink", "path_remove_directory", "path_rename", "path_symlink",
    "path_unlink_file", "poll_oneoff", "random_get", "sched_yield",
    "sock_accept", "sock_recv", "sock_send", "sock_shutdown", "proc_exit",
}


class Reader:
    def __init__(self, data, pos=0):
        self.data, self.pos = data, pos

    def byte(self):
        b = self.data[self.pos]
        self.pos += 1
        return b

    def leb(self):
        result = shift = 0
        while True:
            b = self.byte()
            result |= (b & 0x7F) << shift
            if not b & 0x80:
                return result
            shift += 7

    def name(self):
        n = self.leb()
        s = self.data[self.pos:self.pos + n].decode("utf-8")
        self.pos += n
        return s

    def limits(self):
        flags = self.byte()
        self.leb()
        if flags & 1:
            self.leb()


def heap_type(r):
    # A negative s33: one byte for the abstract types, a type index otherwise.
    b = r.data[r.pos]
    if b & 0x40:
        r.pos += 1
    else:
        r.leb()


def ref_type(r):
    b = r.byte()
    if b in (0x63, 0x64):  # (ref null? ht)
        heap_type(r)


def parse(data):
    if data[:4] != b"\0asm":
        raise SystemExit("not a wasm module")
    r = Reader(data, 8)
    imports, features = [], []
    while r.pos < len(data):
        sid = r.byte()
        size = r.leb()
        end = r.pos + size
        if sid == 2:
            for _ in range(r.leb()):
                module, field, kind = r.name(), r.name(), r.byte()
                if kind == 0:      # func
                    r.leb()
                elif kind == 1:    # table
                    ref_type(r)
                    r.limits()
                elif kind == 2:    # memory
                    r.limits()
                elif kind == 3:    # global
                    r.byte()
                    r.byte()
                elif kind == 4:    # tag
                    r.byte()
                    r.leb()
                else:
                    raise SystemExit(f"unknown import kind {kind}")
                imports.append((module, field, kind))
        elif sid == 0:
            if r.name() == "target_features":
                for _ in range(r.leb()):
                    prefix = chr(r.byte())
                    features.append(prefix + r.name())
        r.pos = end
    return imports, features


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    quiet = "--quiet" in sys.argv
    if len(args) != 1:
        raise SystemExit(__doc__)
    with open(args[0], "rb") as f:
        imports, features = parse(f.read())
    bad = []
    for module, field, kind in imports:
        ok = (
            (module == PREVIEW1 and kind == 0 and field in HOST_PREVIEW1)
            or (module in HOST_MODULES and kind == 0)
        )
        if not ok:
            bad.append(f"{module}.{field}")
    if not quiet:
        for module, field, _ in imports:
            print(f"import {module}.{field}")
        print("target_features " + (" ".join(features) or "(none)"))
    if bad:
        print("IMPORT HYGIENE FAILED, the host does not provide: " + ", ".join(bad), file=sys.stderr)
        return 1
    print(f"imports ok ({len(imports)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
