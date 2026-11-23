/** Settings are plain data; object key order is not an edit. */
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
}

/** Snapshots are owned by history, so later draft edits cannot mutate an undo step. */
export function createHistory<T>(now: () => number = Date.now) {
  const past: T[] = [], future: T[] = []
  let lastEdit = -Infinity
  const push = (stack: T[], value: T): void => {
    stack.push(structuredClone(value))
    if (stack.length > 100) stack.shift()
  }
  return {
    get canUndo(): boolean { return past.length > 0 },
    get canRedo(): boolean { return future.length > 0 },
    record(before: T, after: T): boolean {
      future.length = 0
      if (equal(before, after)) return false
      const time = now()
      if (!past.length || time - lastEdit >= 400) push(past, before)
      lastEdit = time
      return true
    },
    undo(current: T): T | undefined {
      if (!past.length) return undefined
      push(future, current)
      lastEdit = -Infinity
      return past.pop()!
    },
    redo(current: T): T | undefined {
      if (!future.length) return undefined
      push(past, current)
      lastEdit = -Infinity
      return future.pop()!
    },
    clear(): void {
      past.length = future.length = 0
      lastEdit = -Infinity
    }
  }
}
