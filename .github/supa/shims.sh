#!/usr/bin/env bash
# Build-time shims for the Perry compile of Storage. Idempotent; originals are kept as *.orig.
# usage: shims.sh <storage checkout>
set -euo pipefail
root=${1:?storage checkout}

shim() { # <file> <content-or-empty> ; keep the original beside it
  [ -f "$1.orig" ] || cp "$1" "$1.orig"
}

# pg-format: require(__dirname + '/reserved.js') is a computed require, which Perry does not bundle.
p=$root/node_modules/pg-format/lib/index.js
shim "$p"
sed "s#require(__dirname + '/reserved.js')#require('./reserved.js')#" "$p.orig" > "$p"
grep -q "require('./reserved.js')" "$p" || { echo "pg-format shim did not apply" >&2; exit 1; }
# find-my-way builds four functions with `new Function`; swap in equivalent closures.
node "$(dirname "$0")/patch-find-my-way.cjs" "$root"
# fastify compiles every route's validators and serializers while the routes register
# (ajv and fast-json-stringify code generation); build each on its first use instead.
# SUPA_LAZY_SCHEMAS=0 restores the eager original, for A/B measurements.
if [ "${SUPA_LAZY_SCHEMAS:-1}" = 0 ]; then
  node "$(dirname "$0")/patch-fastify-lazy-schema.cjs" "$root" off
else
  node "$(dirname "$0")/patch-fastify-lazy-schema.cjs" "$root"
fi

echo "shims applied under $root/node_modules"
