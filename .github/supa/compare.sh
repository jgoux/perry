#!/usr/bin/env bash
# Diff the node and native smoke transcripts. usage: compare.sh <node.txt> <native.txt>
set -uo pipefail
if diff -u "$1" "$2"; then echo "transcripts identical"; else echo "transcripts differ"; exit 1; fi
