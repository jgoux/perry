#!/usr/bin/env bash
# usage: prune-caches.sh <key-prefix> <keep>
# Delete all but the <keep> newest Actions caches whose key starts with the
# prefix, so per-run cache keys do not eat the repository's 10 GB budget.
set -euo pipefail
prefix=${1:?prefix}; keep=${2:?keep}
gh cache list --key "$prefix" --sort created_at --order desc --limit 100 --json id,key,sizeInBytes \
  --jq '.[] | "\(.id) \(.key) \(.sizeInBytes)"' | tail -n +"$((keep + 1))" \
  | while read -r id key size; do
      echo "deleting cache $key ($((size / 1048576)) MiB)"
      gh cache delete "$id" || true
    done
