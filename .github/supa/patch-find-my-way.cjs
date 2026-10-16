'use strict';
// Replaces find-my-way 9.7.0's four `new Function` generators with equivalent
// closures. The compiled binary has no source evaluator for these, and Storage
// reaches all four at router setup. Each replacement keeps the generator's
// inputs (computed at the same point, so the baked constants match) and only
// swaps the generated function for a closure over them.
// usage: node patch-find-my-way.cjs <storage checkout>
const fs = require('fs');
const path = require('path');
const lib = path.join(process.argv[2], 'node_modules', 'find-my-way', 'lib');

function patch(file, from, to) {
  const p = path.join(lib, file);
  if (!fs.existsSync(p + '.orig')) fs.copyFileSync(p, p + '.orig');
  const src = fs.readFileSync(p + '.orig', 'utf8');
  if (src.split(from).length !== 2) throw new Error(`${file}: expected exactly one occurrence of: ${from}`);
  fs.writeFileSync(p, src.replace(from, () => to));
}

patch('handler-storage.js',
  "return new Function('NullObject', fnBody.join('\\n'))(NullObject)  // eslint-disable-line",
  `return function _createParamsObject (paramsArray) {
      const params_ = new NullObject()
      for (let i = 0; i < params.length; i++) {
        params_[params[i]] = paramsArray[i]
      }
      return params_
    }`);

// The second patch in this file starts from the already-patched text, so apply
// it on top of the first.
{
  const p = path.join(lib, 'handler-storage.js');
  const from = "this._getHandlerMatchingConstraints = new Function('derivedConstraints', lines.join('\\n')) // eslint-disable-line";
  const src = fs.readFileSync(p, 'utf8');
  if (src.split(from).length !== 2) throw new Error('handler-storage.js: matcher generator not found');
  const to = `const initialCandidates = (1 << this.handlers.length) - 1
    const steps = []
    for (const constraint of this.constraints) {
      steps.push({
        constraint,
        mask: this._constrainedIndexBitmask(constraint),
        mustMatch: !!constrainer.strategies[constraint].mustMatchWhenDerived
      })
    }
    const mustNotBeDerived = []
    for (const constraint in constrainer.strategies) {
      if (!Object.hasOwn(constrainer.strategies, constraint)) continue
      if (constrainer.strategies[constraint].mustMatchWhenDerived && !this.constraints.includes(constraint)) {
        mustNotBeDerived.push(constraint)
      }
    }
    this._getHandlerMatchingConstraints = function (derivedConstraints) {
      let candidates = initialCandidates
      let matches
      for (let s = 0; s < steps.length; s++) {
        const step = steps[s]
        const value = derivedConstraints[step.constraint]
        if (value === undefined) {
          candidates &= step.mask
        } else {
          matches = this.constrainedHandlerStores[step.constraint].get(value) || 0
          candidates &= step.mustMatch ? matches : (matches | step.mask)
        }
        if (candidates === 0) return null
      }
      for (let s = 0; s < mustNotBeDerived.length; s++) {
        if (derivedConstraints[mustNotBeDerived[s]] !== undefined) return null
      }
      return this.handlers[31 - Math.clz32(candidates)]
    }`;
  fs.writeFileSync(p, src.replace(from, () => to));
}

patch('constrainer.js',
  "this.deriveSyncConstraints = new Function('req', 'ctx', lines.join('\\n')).bind(this) // eslint-disable-line",
  `const self = this
    const names = []
    const derivers = []
    for (const key of this.strategiesInUse) {
      const strategy = this.strategies[key]
      if (!strategy.isCustom) {
        if (key === 'version') {
          names.push('version')
          derivers.push(function (req) { return req.headers['accept-version'] })
        } else {
          names.push('host')
          derivers.push(function (req) { return req.headers.host || req.headers[':authority'] })
        }
      } else {
        names.push(strategy.name)
        derivers.push(function (req, ctx) { return self.strategies[key].deriveConstraint(req, ctx) })
      }
    }
    this.deriveSyncConstraints = function (req, ctx) {
      const derived = {}
      for (let i = 0; i < names.length; i++) {
        derived[names[i]] = derivers[i](req, ctx)
      }
      return derived
    }`);

patch('node.js',
  "this.matchPrefix = new Function('path', 'i', `return ${lines.join(' && ')}`) // eslint-disable-line",
  `const prefix = this.prefix
    this.matchPrefix = function (path, i) {
      for (let k = 1; k < prefix.length; k++) {
        if (path.charCodeAt(i + k) !== prefix.charCodeAt(k)) return false
      }
      return true
    }`);

console.log('find-my-way patched under ' + lib);
