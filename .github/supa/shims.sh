#!/usr/bin/env bash
# Build-time shims for the Perry compile of Storage. Idempotent; originals are kept as *.orig.
# usage: shims.sh <storage checkout>
set -euo pipefail
root=${1:?storage checkout}

shim() { # <file> <content-or-empty> ; keep the original beside it
  [ -f "$1.orig" ] || cp "$1" "$1.orig"
}

# agentkeepalive subclasses http.Agent, which Perry cannot do; alias the plain node agents.
d=$root/node_modules/agentkeepalive/lib
shim "$d/agent.js"
shim "$d/https_agent.js"
printf "'use strict';\nmodule.exports = require('http').Agent;\n" > "$d/agent.js"
printf "'use strict';\nmodule.exports = require('https').Agent;\n" > "$d/https_agent.js"

# pg-format: require(__dirname + '/reserved.js') is a computed require, which Perry does not bundle.
p=$root/node_modules/pg-format/lib/index.js
shim "$p"
sed "s#require(__dirname + '/reserved.js')#require('./reserved.js')#" "$p.orig" > "$p"
grep -q "require('./reserved.js')" "$p" || { echo "pg-format shim did not apply" >&2; exit 1; }
echo "shims applied under $root/node_modules"
