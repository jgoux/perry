// Temporary diagnostic: report which route context lacks `preParsing` when a
// request reaches runPreParsing, and what the preReady loops assigned.
const fs = require('fs')
const root = process.argv[2]
const patch = (file, pairs) => {
  const p = `${root}/node_modules/fastify/lib/${file}`
  if (!fs.existsSync(p + '.diag.orig')) fs.copyFileSync(p, p + '.diag.orig')
  let s = fs.readFileSync(p + '.diag.orig', 'utf8')
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`diag patch anchor missing in ${file}: ${from}`)
    s = s.replace(from, to)
  }
  fs.writeFileSync(p, s)
}
patch('route.js', [
  ["  if (request[kRouteContext].preParsing !== null) {",
   "  if (request[kRouteContext].preParsing === undefined) console.error('DIAG preParsing undefined url=' + request.url + ' keys=' + Object.keys(request[kRouteContext]).join(',') + ' onRequest=' + String(request[kRouteContext].onRequest))\n  if (request[kRouteContext].preParsing !== null) {"],
  ["            context[hook] = toSet.length ? toSet : null\n          }\n\n          // Optimization",
   "            context[hook] = toSet.length ? toSet : null\n            if (hook === 'preParsing') console.error('DIAG route preReady ' + String(opts.url) + ' preParsing=' + String(context.preParsing) + ' keys=' + Object.keys(context).length)\n          }\n\n          // Optimization"],
])
patch('four-oh-four.js', [
  ["        context[hook] = toSet.length ? toSet : null\n      }\n      context.errorHandler",
   "        context[hook] = toSet.length ? toSet : null\n        if (hook === 'preParsing') console.error('DIAG 404 preReady preParsing=' + String(context.preParsing))\n      }\n      context.errorHandler"],
])

{
  const p = `${root}/node_modules/ajv/dist/compile/index.js`
  if (!fs.existsSync(p + '.diag.orig')) fs.copyFileSync(p, p + '.diag.orig')
  let s = fs.readFileSync(p + '.diag.orig', 'utf8')
  const from = '        if (sourceCode)\n            this.logger.error("Error compiling schema, function code:", sourceCode);'
  if (!s.includes(from)) throw new Error('diag patch anchor missing in ajv compile/index.js')
  s = s.replace(from, from + '\n        console.error("DIAG ajv compile error: " + String(e && e.message) + " | schema=" + JSON.stringify(sch.schema).slice(0, 300) + " | stack=" + String(e && e.stack) + " | here=" + new Error("here").stack);')
  fs.writeFileSync(p, s)
}
console.log('diag-fastify applied')
