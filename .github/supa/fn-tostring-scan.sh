#!/usr/bin/env bash
# Lists the places in a Storage checkout that may read a function's source text.
#   fn-tostring-scan.sh <storage checkout>
# Perry keeps each compiled function's source for Function.prototype.toString; with
# `--function-source=header` it keeps `function name(params) { /* source elided */ }`
# instead. A consumer that parses a body, or detects `async`, `extends` or a default value
# from the text, would behave differently. This prints every candidate (package, file, line)
# grouped by pattern, for review by hand: it over-approximates on purpose.
set -uo pipefail
root=${1:?storage checkout}
cd "$root"
dirs=()
for d in node_modules dist; do [ -d "$d" ] && dirs+=("$d"); done
[ ${#dirs[@]} -gt 0 ] || { echo "no node_modules or dist under $root" >&2; exit 2; }

scan() { # <label> <ERE>
  echo "== $1"
  grep -rEn --include='*.js' --include='*.cjs' --include='*.mjs' --exclude='*.min.js' "$2" "${dirs[@]}" 2>/dev/null \
    | grep -v '^[^:]*/\(test\|tests\|__tests__\|docs\|example\|examples\|benchmarks\|bench\)/' \
    | cut -c1-240 | sort -u
  echo
}

# Function.prototype.toString reached directly or through a cached reference.
scan "Function.prototype.toString and cached references" \
  '(Function\.prototype|funcProto|fnProto|FunctionPrototype|Function)\.toString|(funcToString|fnToString|functionToString|funcToStr|fnToStr|FunctionPrototypeToString)\b'
# toString() on something named like a function, and String(fn).
scan "fn.toString() / String(fn) on function-looking names" \
  '\b(fn|func|fun|fnc|cb|callback|handler|plugin|hook|method|ctor|Ctor|cls|Class|klass|clazz|wrapped|original|listener|factory|validate|serialize|serializer|fn[0-9]|func[0-9]|f)\.toString\(\)|String\((fn|func|fun|cb|callback|handler|plugin|method|ctor|Ctor|cls|Class|listener|factory)\)'
# The text of a function fed to a parser: a regex, split, slice, includes, startsWith.
scan "toString() result parsed as source" \
  '\.toString\(\)\)?\s*\.(match|split|replace|slice|indexOf|includes|startsWith|endsWith|test|substring|substr|search|trim)\b|\.(test|exec)\([^)]*\.toString\(\)\)|\.toString\(\)\s*(===?|!==?)\s*[a-zA-Z_$]+\.toString\(\)'
# Source-shaped regexes: the start of a class, async function or function.
scan "source-shaped regexes (class / async / function / arrow prefix)" \
  '/\^(\\s\*)?(\(\?:)?\(?(class|async|function)|\[native code\]|native code\}'
# Async/generator detection (by constructor name, not source: listed to confirm).
scan "async / generator function detection" \
  '\b(AsyncFunction|GeneratorFunction|AsyncGeneratorFunction)\b|isAsyncFunction|\bisGeneratorFunction'
# Parameter-name based DI: reads the parameter list out of the source.
scan "parameter-name parsing" \
  'getParamNames|getParameterNames|parseParams|argNames|getArguments|fnArgs|STRIP_COMMENTS|ARGUMENT_NAMES|FN_ARGS|annotate\('
