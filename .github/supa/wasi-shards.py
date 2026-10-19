#!/usr/bin/env python3
"""Split the wasi-linux work (probes and sjlj-size cells) into balanced shards.

usage: wasi-shards.py SHARDS [NAME...]

Without names: every probe in wasi-probes/*.js plus every sjlj-size.sh cell, spread over
SHARDS shards by greedy longest-processing-time on the weights in wasi-probe-weights.txt.
With names: one shard that runs just those probes (an unknown name is an error), no sjlj
cells; the iteration mode of the wasi_probe_names input.

Prints one JSON object:
  include         matrix entries {shard, probes, sjlj} (space-separated lists)
  expected_probes sorted probe names the shards must run, each exactly once
  expected_sjlj   sorted sjlj cells (kind:N) the shards must run, each exactly once
wasi-verify.sh checks the shards' records against the two expected lists.
"""
import json
import os
import subprocess
import sys

here = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WEIGHT = 3


def main():
    if len(sys.argv) < 2 or not sys.argv[1].isdigit() or int(sys.argv[1]) < 1:
        sys.exit(__doc__)
    shards = int(sys.argv[1])
    names = sys.argv[2:]
    all_probes = sorted(f[:-3] for f in os.listdir(os.path.join(here, "wasi-probes")) if f.endswith(".js"))
    if names:
        unknown = [n for n in names if n not in all_probes]
        if unknown:
            sys.exit("unknown wasi probe(s): " + " ".join(unknown))
        if len(set(names)) != len(names):
            sys.exit("duplicate wasi probe name(s) in the list")
        out = {"include": [{"shard": 1, "probes": " ".join(names), "sjlj": ""}],
               "expected_probes": sorted(names), "expected_sjlj": []}
        print(json.dumps(out))
        return

    cells = subprocess.check_output([os.path.join(here, "sjlj-size.sh"), "--list"], text=True).split()
    weights = {}
    with open(os.path.join(here, "wasi-probe-weights.txt")) as f:
        for line in f:
            line = line.split("#", 1)[0].split()
            if len(line) == 2:
                weights[line[0]] = float(line[1])
    items = [("p", n, weights.get(n, DEFAULT_WEIGHT)) for n in all_probes]
    items += [("s", c, weights.get("sjlj:" + c, 30)) for c in cells]
    items.sort(key=lambda i: (-i[2], i[1]))  # heaviest first, name breaks ties: the layout is deterministic
    load = [0.0] * shards
    bins = [{"probes": [], "sjlj": []} for _ in range(shards)]
    for kind, name, w in items:
        k = min(range(shards), key=lambda j: (load[j], j))
        load[k] += w
        bins[k]["probes" if kind == "p" else "sjlj"].append(name)
    include = []
    for k, b in enumerate(bins):
        if not b["probes"] and not b["sjlj"]:
            continue
        include.append({"shard": k + 1, "probes": " ".join(sorted(b["probes"])), "sjlj": " ".join(b["sjlj"])})
        print("shard %d: %3d probes, %d sjlj cells, ~%.0f s" % (k + 1, len(b["probes"]), len(b["sjlj"]), load[k]),
              file=sys.stderr)
    print(json.dumps({"include": include, "expected_probes": all_probes, "expected_sjlj": sorted(cells)}))


main()
