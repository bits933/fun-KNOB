// Owner: orchestrator. A dial slot's icon: the app's real .exe icon for app slots, else the SVG set.
import { useEffect, useState } from 'react'
import type { DialSlotView, IconName } from '@shared/types'
import { Icon } from './Icon'

// One request per exe for the whole page; null = no icon, fall back to the SVG.
const cache = new Map<string, Promise<string | null>>()
const load = (exe: string): Promise<string | null> => {
  let p = cache.get(exe)
  if (!p) {
    p = window.kreo?.getAppIcon(exe).catch(() => null) ?? Promise.resolve(null)
    cache.set(exe, p)
  }
  return p
}

export function SlotIcon({ slot, size, fallback, zoom = 1.4 }: { slot: DialSlotView; size: number; fallback?: IconName; zoom?: number }): React.JSX.Element {
  const exe = slot.kind === 'app' && !slot.missing ? slot.exePath : undefined
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (!exe) return
    let live = true
    void load(exe).then(u => { if (live) setUrl(u) })
    return () => { live = false }
  }, [exe])
  // Windows icons carry built-in padding, so draw them `zoom`x and pull the margins in: same layout box as the SVG.
  // maxWidth none: Tailwind's `img { max-width: 100% }` would clamp it to the box and leave the negative margins off-centre.
  if (url) {
    const big = Math.round(size * zoom), m = (size - big) / 2
    return <img src={url} width={big} height={big} alt="" draggable={false} style={{ display: 'block', objectFit: 'contain', maxWidth: 'none', margin: m }} />
  }
  return <Icon name={fallback ?? (slot.kind === 'empty' ? 'empty-slot' : slot.missing ? 'warning' : slot.icon)} size={size} />
}
