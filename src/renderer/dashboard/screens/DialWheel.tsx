import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import { MIN_SLOTS, MAX_SLOTS } from '@shared/types'
import type { DialSlotView, DialView } from '@shared/types'
import { DialPicker, DialPreview, IconButton } from '../ui'

const CHIP = 48 // lifted chip diameter
const CHIP_ICON = 24
const GLIDE = 180
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Array move: take `from` out and put it back in at `to`; the items between shift by one. */
export const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}
const range = (n: number): number[] => [...Array(n).keys()]
const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const chipAt = (x: number, y: number): string => `translate(${x - CHIP / 2}px, ${y - CHIP - 10}px)` // above the pointer, never over the label under it

type Drag = { from: number; to: number; over: boolean; inRemove: boolean }

/** The editable wheel: click to select, drag a slot round the ring to move it (the others slide to make room), drop it on the band under the wheel to delete it. */
export function DialWheel({ view, selected, onSelect, onOpen, onMove, onRemove, onAdd, onBack, kinds, pathKey, backward }: {
  view: DialView; selected: number | null; onSelect: (i: number) => void; onOpen: (i: number) => void
  onMove: (from: number, to: number) => void; onRemove: (i: number) => void; onAdd: () => void; onBack?: () => void; kinds: string[]; pathKey: string; backward: boolean
}): React.JSX.Element {
  const previous = useRef({ pathKey, view })
  const [old, setOld] = useState<DialView | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const removeRef = useRef<HTMLDivElement>(null)
  const [dialSize, setDialSize] = useState(420)
  // The dial's own drop zone (centred under the wheel, never reaching the side panel or apps rail) only exists after the first commit.
  const [pane, setPane] = useState<Element | null>(null)
  useEffect(() => setPane(root.current?.closest('.dial-drop-zone') ?? root.current?.closest('.split__pane') ?? root.current?.closest('.split__main') ?? document.querySelector('.app__screens') ?? document.body), [])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = (): void => {
      const w = el.clientWidth
      if (w <= 0) return
      const next = w >= 590 ? 420 : Math.max(250, Math.min(420, Math.floor(w - 220)))
      setDialSize((prev) => (prev === next ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const chipRef = useRef<HTMLDivElement>(null)
  const press = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null)
  const live = useRef<Drag | null>(null) // what pointer handlers trust; `drag` only drives rendering
  const pt = useRef({ x: 0, y: 0 })
  const busy = useRef(false) // the chip is still gliding / fading
  const suppress = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [lifted, setLifted] = useState<number | null>(null)
  const [chip, setChip] = useState<{ slot: DialSlotView; out?: boolean } | null>(null)
  const [snap, setSnap] = useState<number[] | null>(null)

  const k = dialSize / 600 // the dial artwork is 600 px
  const rIcon = 158 * k // ring icon centre, px from the middle
  const rLabel = 211 * k + 14 // labels start just outside the grey ring
  const dead = 111 * k * 0.6 // too close to the middle to read an angle
  const backSize = Math.round(124 * k)

  const n = view.slots.length
  const step = 360 / n
  const blocked = n <= MIN_SLOTS
  const angles = snap ?? (() => {
    const a = range(n).map(i => i * step)
    if (drag) moveItem(range(n), drag.from, drag.to).forEach((slot, pos) => { a[slot] = pos * step })
    return a
  })()

  useEffect(() => {
    if (previous.current.pathKey !== pathKey) {
      setOld(previous.current.view)
      const r = reduced()
      root.current?.querySelectorAll('.k-dialpick .k-dial__icon').forEach((el, i) => {
        el.animate(r ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `scale(${backward ? 1.18 : 0.7})` }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, delay: (backward ? 7 - i : i) * 8, fill: 'backwards', easing: 'ease-out' })
      })
    }
    previous.current = { pathKey, view }
  }, [pathKey, view, backward])
  useEffect(() => {
    if (!old) return
    const timer = window.setTimeout(() => setOld(null), 200)
    return () => window.clearTimeout(timer)
  }, [old])
  // One painted frame at the snap angles with transitions off, then let them slide to their real places.
  useEffect(() => {
    if (!snap) return
    let b = 0
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setSnap(null)) })
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b) }
  }, [snap])

  const centre = (): { x: number; y: number } => {
    const r = root.current!.querySelector('.k-dialpick')!.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  const slotPoint = (pos: number): { x: number; y: number } => {
    const c = centre(), a = pos * step * Math.PI / 180
    return { x: c.x + rIcon * Math.sin(a), y: c.y - rIcon * Math.cos(a) }
  }
  const targetAt = (x: number, y: number): number | null => {
    const c = centre(), dx = x - c.x, dy = y - c.y
    if (Math.hypot(dx, dy) < dead) return null
    return Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) / step) % n
  }
  const inRemove = (x: number, y: number): boolean => {
    const r = removeRef.current?.getBoundingClientRect()
    return !!r && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12
  }
  const set = (d: Drag | null): void => {
    const p = live.current
    live.current = d
    if (!d || !p || p.to !== d.to || p.over !== d.over || p.inRemove !== d.inRemove) setDrag(d)
  }
  /** Chip flies to a ring position, shrinking to icon size while its disc fades, then `done`. */
  const glide = (pos: number, done: () => void): void => {
    const el = chipRef.current
    busy.current = true
    const finish = (): void => { busy.current = false; done() }
    if (!el) { finish(); return }
    if (reduced()) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).onfinish = finish; return }
    const p = slotPoint(pos)
    const opts = { duration: GLIDE, easing: EASE, fill: 'forwards' as const }
    el.querySelector('.mdial__chipbg')?.animate([{ opacity: 1 }, { opacity: 0 }], opts)
    el.animate([{ transform: el.style.transform }, { transform: `translate(${p.x - CHIP / 2}px, ${p.y - CHIP / 2}px) scale(${28 * k / CHIP_ICON})` }], opts).onfinish = finish
  }
  const cancel = (): void => {
    const d = live.current
    press.current = null
    set(null)
    if (d) glide(d.from, () => { setLifted(null); setChip(null) }) // everything slides back, the chip flies home
  }
  const drop = (d: Drag): void => {
    set(null)
    if (d.over) {
      // Survivors start where they sit now (gap open), then close up round the ring.
      const now = moveItem(range(n), d.from, d.to)
      const from = range(n).map(i => now.indexOf(i) * step).filter((_, i) => i !== d.from)
      busy.current = true
      setChip(c => c && { ...c, out: true })
      const el = chipRef.current
      const anim = el?.animate(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: el.style.transform }, { opacity: 0, transform: `${el.style.transform} scale(0.5)` }], { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
      const end = (): void => { busy.current = false; setChip(null) }
      if (anim) anim.onfinish = end; else end()
      onRemove(d.from); setSnap(from); setLifted(null)
      return
    }
    setDrag(d) // keep the gap open while the chip lands in it
    glide(d.to, () => {
      if (d.from !== d.to) { onMove(d.from, d.to); setSnap(range(n).map(i => i * step)) }
      setDrag(null); setLifted(null); setChip(null)
    })
  }
  useEffect(() => {
    if (!drag) return
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape' && live.current) { e.preventDefault(); e.stopPropagation(); cancel() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })

  const indexAt = (target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null
    const button = target.closest('button')
    const label = button?.getAttribute('aria-label')?.match(/^Slot (\d+):/)
    const raw = label ? Number(label[1]) - 1 : button?.getAttribute('data-slot')
    return raw === null || raw === undefined ? null : Number(raw)
  }
  const armed = !!drag?.over || !!chip?.out
  return <div ref={root} className="mdial" data-backward={backward} data-dragging={drag ? drag.from : undefined} style={{ '--dial': `${dialSize}px` } as React.CSSProperties}
    onKeyDownCapture={e => {
      const i = indexAt(e.target)
      if (e.key === 'Enter' && i !== null && selected === i && (view.slots[i].kind === 'folder' || view.slots[i].kind === 'app')) { e.preventDefault(); onOpen(i) }
    }}
    onClickCapture={e => { if (suppress.current) { e.stopPropagation(); suppress.current = false } }}
    onDoubleClick={e => { const i = indexAt(e.target); if (i !== null) onOpen(i) }}
    onPointerDown={e => {
      const i = indexAt(e.target)
      if (e.button !== 0 || i === null || busy.current) return
      suppress.current = false
      press.current = { index: i, x: e.clientX, y: e.clientY, moved: false }
    }}
    onPointerMove={e => {
      const p = press.current
      if (!p) return
      pt.current = { x: e.clientX, y: e.clientY }
      if (!p.moved) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 6) return
        p.moved = true
        e.currentTarget.setPointerCapture(e.pointerId)
        set({ from: p.index, to: p.index, over: false, inRemove: false })
        setLifted(p.index)
        setChip({ slot: view.slots[p.index] })
      }
      if (chipRef.current) chipRef.current.style.transform = chipAt(e.clientX, e.clientY)
      const d = live.current!
      const into = inRemove(e.clientX, e.clientY)
      set({ ...d, to: into ? d.to : targetAt(e.clientX, e.clientY) ?? d.to, over: into && !blocked, inRemove: into })
    }}
    onPointerCancel={cancel}
    onPointerUp={() => {
      const p = press.current
      press.current = null
      if (!p?.moved) return
      // Swallow only the click this drag's release produces; a drop on the delete band (outside this element)
      // never delivers one here, so the flag must not linger and eat the next real click.
      suppress.current = true
      window.setTimeout(() => { suppress.current = false }, 0)
      if (live.current) drop(live.current)
    }}>
    <div ref={stageRef} className="mdial__stage">
      <DialPicker view={view} size={dialSize} selected={drag ? drag.from : selected} onSelect={onSelect} aria-label={`${view.levelLabel ?? 'Main'} dial`}
        angles={angles} lifted={lifted} snap={!!snap} />
      {old && <div className="mdial__depart" aria-hidden="true"><DialPreview view={old} size={dialSize} /></div>}
      {onBack && <button type="button" className="mdial__back" style={{ width: backSize, height: backSize, margin: `${-backSize / 2}px 0 0 ${-backSize / 2}px` }} onClick={onBack} aria-label={`Back from ${view.levelLabel}`}><Icon name="chevron-left" size={Math.max(14, Math.round(18 * dialSize / 420))} /><span>{view.levelLabel}</span></button>}
      {view.slots.map((s, i) => {
        const deg = angles[i] ?? i * step
        const a = deg * Math.PI / 180
        const sin = Math.sin(a), cos = Math.cos(a)
        const title = `${s.name}${kinds[i] ? ` — ${kinds[i]}` : ''}`
        // Anchor the label's box on the side facing the ring, so every label sits the same distance off it.
        return <button key={i} type="button" data-slot={i} className="mdial__label" data-side={sin > 0.35 ? 'right' : sin < -0.35 ? 'left' : 'mid'}
          data-lifted={lifted === i} data-snap={!!snap} data-empty={s.kind === 'empty' || undefined} aria-pressed={selected === i} title={title}
          style={{ transform: `translate(${-(1 - sin) * 50}%, ${-(1 + cos) * 50}%) rotate(${deg}deg) translateY(${-rLabel}px) rotate(${-deg}deg)` }}
          onClick={() => onSelect(i)}>
          <span className="mdial__name">{s.name}</span>
        </button>
      })}
    </div>
    <div className="mdial__foot" data-dragging={!!drag || !!chip}>
      <div className="mdial__add" aria-hidden={!!drag}>
        <IconButton className="mdial__plus h-11 w-11 rounded-full bg-white/[0.06] border border-white/[0.09] text-foreground hover:bg-white/[0.11] hover:border-white/[0.15] disabled:bg-white/[0.04] disabled:border-white/[0.06] disabled:opacity-45" icon="plus" iconSize={20} label="Add option" title={n >= MAX_SLOTS ? 'Up to 8 options' : 'Add option'} disabled={n >= MAX_SLOTS} tabIndex={drag ? -1 : undefined} onClick={onAdd} />
      </div>
    </div>
    {/* The delete area is the bottom edge of the dial pane, never under the side panel. */}
    {pane && createPortal(<div ref={removeRef} className="mdial__remove" data-visible={!!drag} data-armed={armed} data-blocked={blocked} aria-hidden={!drag}>
      <Icon name="trash" size={18} /><span>{blocked ? `Needs at least ${MIN_SLOTS} options` : 'Drop to remove'}</span>
    </div>, pane)}
    {chip && createPortal(<div ref={chipRef} className="mdial__chip" data-armed={armed} style={{ transform: chipAt(pt.current.x, pt.current.y) }} aria-hidden="true">
      <span className="mdial__chipbg" /><span className="mdial__chipicon"><SlotIcon slot={chip.slot} size={CHIP_ICON} /></span>
    </div>, document.body)}
  </div>
}
