export const kFields = Symbol.for('plt.globals.fields')

export function getGlobal () {
  return globalThis.platformatic
}

export function updateGlobals (updates) {
  globalThis.platformatic ??= {}
  Object.assign(globalThis.platformatic, updates)
  return globalThis.platformatic
}
