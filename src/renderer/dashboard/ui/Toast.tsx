import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@renderer/icons/Icon'

/** Frosted glass pill message, e.g. "Saved". Static; use `useToast` to show one temporarily. */
export function Toast({ message, icon = 'check' }: { message: string; icon?: string }): React.JSX.Element {
  return (
    <div
      className="k-toast inline-flex items-center gap-2.5 h-11 px-5 border border-white/[0.09] rounded-full bg-[#11151e]/95 backdrop-blur-xl text-[14px] font-medium text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,0.62)]"
      role="status"
    >
      <span className="k-toast__icon flex text-accent-foreground">
        <Icon name={icon} size={18} />
      </span>
      <span>{message}</span>
    </div>
  )
}

function findRingTarget(): Element | null {
  const dropZone =
    document.querySelector('.screen:not(.screen--leaving) .dial-drop-zone') ??
    document.querySelector('.dial-drop-zone')
  if (dropZone && !dropZone.closest('.screen--leaving')) return dropZone

  const splitPane =
    document.querySelector('.screen:not(.screen--leaving) .split__pane') ??
    document.querySelector('.split__pane')
  if (splitPane && !splitPane.closest('.screen--leaving')) return splitPane

  return null
}

/**
 * `const { toast, show } = useToast()`; render `{toast}` once inside `.app__screens`
 * (or any `position: relative` container) and call `show('Saved')`. Portals into the active
 * ring pane (`.dial-drop-zone` or `.split__pane`) when present and hides after 2.2 s.
 */
export function useToast(): { toast: ReactNode; show: (message: string, icon?: string) => void } {
  const [item, setItem] = useState<{
    n: number
    message: string
    icon?: string
    target: Element | null
  } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string, icon?: string) => {
    window.clearTimeout(timer.current)
    const target = findRingTarget()
    setItem((p) => ({ n: (p?.n ?? 0) + 1, message, icon, target }))
    timer.current = window.setTimeout(() => setItem(null), 2200)
  }, [])

  useEffect(() => {
    if (!item || item.target?.isConnected) return
    const next = findRingTarget()
    if (next) {
      setItem((prev) => (prev && prev.n === item.n ? { ...prev, target: next } : prev))
    }
  }, [item])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const zone = item ? (
    <div className="k-toastzone" key={item.n}>
      <Toast message={item.message} icon={item.icon} />
    </div>
  ) : null

  const liveTarget = item ? (item.target?.isConnected ? item.target : findRingTarget()) : null
  const toast = zone ? (liveTarget ? createPortal(zone, liveTarget) : zone) : null
  return { toast, show }
}
