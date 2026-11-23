import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lets a list row fade out before it is removed. `const { leaving, remove } = useFadeRemove<string>()`;
 * give the row `className={leaving === id ? 'k-row-leave' : 'k-row-enter'}` and call `remove(id, () => actuallyDelete(id))`.
 * `k-row-enter` / `k-row-leave` are in extras.css (opacity + 4 px move; opacity only with reduced motion).
 */
export function useFadeRemove<K>(ms = 140): { leaving: K | null; remove: (key: K, commit: () => void) => void } {
  const [leaving, setLeaving] = useState<K | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const remove = useCallback(
    (key: K, commit: () => void) => {
      window.clearTimeout(timer.current)
      setLeaving(key)
      timer.current = window.setTimeout(() => {
        setLeaving(null)
        commit()
      }, ms)
    },
    [ms]
  )
  return { leaving, remove }
}
