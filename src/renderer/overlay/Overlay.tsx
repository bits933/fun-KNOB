import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { LEVEL_RING_MS } from '@shared/defaults'
import type { DialSlotView, DialView, Readout } from '@shared/types'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import { nextAngle } from './angle'
import type { OverlayData } from './data'

// Geometry from Figma "Dial" (420 px instance): disc 420, ring 295.4 with inner radius 52.6 %,
// highlight wedge 34 deg wide, icons 19.6 px on radius 110.6, marker triangle 7 x 6.3 at radius 131.6.
const C = 210
const R_OUT = 147.7
const R_IN = 77.7
const ICON_SIZE = 19.6
const ICON_R = 110.6
const DEPTH = { main: 0, folder: 1, app: 2 }

const pt = (r: number, deg: number): string => {
  const a = (deg * Math.PI) / 180
  return `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`
}
/** The highlight wedge pointing at the top; rotated by CSS to any slot. */
const wedge = (n: number): string => { const HALF = 17 * 8 / n; return `path('M${pt(R_OUT, -HALF)} A${R_OUT} ${R_OUT} 0 0 1 ${pt(R_OUT, HALF)} L${pt(R_IN, HALF)} A${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, -HALF)}Z')` }

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Keeps the previous value around for `ms` after `key` changes so it can fade out while the new one fades in.
 * Derives state during render (no extra frame): `id` changes when `key` does.
 */
function useLeaving<T>(
  key: string,
  value: T,
  ms: number
): { id: number; from: T | null; leaving: { id: number; v: T }[] } {
  const [s, setS] = useState({ key, id: 0, from: null as T | null, leaving: [] as { id: number; v: T }[] })
  const last = useRef(value)
  if (key !== s.key) setS({ key, id: s.id + 1, from: last.current, leaving: [...s.leaving, { id: s.id, v: last.current }].slice(-2) })
  useEffect(() => {
    last.current = value
  })
  useEffect(() => {
    if (!s.leaving.length) return
    const t = setTimeout(() => setS((x) => ({ ...x, leaving: [] })), ms)
    return () => clearTimeout(t)
  }, [s.leaving, ms])
  return s
}

// ───────────────────────── slots ─────────────────────────

interface SlotsProps {
  slots: DialSlotView[]
  highlight: number
}

function Slots({ slots, highlight, className }: SlotsProps & { className: string }): JSX.Element {
  return (
    <div className={`slots ${className}`}>
      {slots.map((s, i) => {
        const a = (i * 360 / slots.length * Math.PI) / 180
        const left = C + ICON_R * Math.sin(a) - ICON_SIZE / 2
        const top = C - ICON_R * Math.cos(a) - ICON_SIZE / 2
        return (
          <div key={i} className="slot" style={{ left, top, '--i': i } as CSSProperties}>
            <span className="slot-icon" data-on={i === highlight}>
              <SlotIcon slot={s} size={ICON_SIZE} />
            </span>
            {s.active && (
              <span className="slot-dot" style={{ transform: `rotate(${i * 360 / slots.length}deg) translateY(16px)` }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── centre ─────────────────────────

interface CentreText {
  level: string | null
  name: string
  hint: string | null
}

function centreText(view: DialView, paused: boolean): CentreText {
  if (paused) return { level: null, name: 'Paused', hint: null }
  const s = view.slots[view.highlight]
  if (!s) return { level: view.levelLabel, name: '', hint: null }
  if (s.missing) return { level: view.levelLabel, name: `${s.name} not found`, hint: 'Click to locate the app' }
  const hint = view.hint ?? (s.kind === 'folder' ? 'Click to open folder' : null)
  return { level: view.levelLabel, name: s.name, hint }
}

function CentreBlock({ t, className }: { t: CentreText; className: string }): JSX.Element {
  return (
    <div className={`centre-text ${className}`}>
      {t.level && <div className="c-level">{t.level}</div>}
      <div className="c-name">{t.name}</div>
      {t.hint && <div className="c-hint">{t.hint}</div>}
    </div>
  )
}

// ───────────────────────── dial ─────────────────────────

function Dial({ view, paused }: { view: DialView; paused: boolean }): JSX.Element {
  // Highlight angle, tracked continuously so 7 -> 0 goes forward one step. Retargeting is just a new
  // value: the CSS transition restarts from wherever the wedge is now, nothing is queued.
  const [ang, setAng] = useState({ h: view.highlight, open: view.open, n: view.slots.length, a: view.highlight * 360 / view.slots.length, snap: true })
  if (view.highlight !== ang.h || view.open !== ang.open || view.slots.length !== ang.n) {
    setAng({
      n: view.slots.length, h: view.highlight,
      open: view.open,
      a: nextAngle(ang.a, view.highlight, view.slots.map((s) => s.kind !== 'empty')),
      snap: !(ang.open && view.open) // jump without gliding while the dial is closed / just opening
    })
  }

  // Chosen pulse
  const pulse = useRef<HTMLDivElement>(null)
  const tick = useRef(view.chosenTick)
  useEffect(() => {
    if (view.chosenTick === tick.current) return
    tick.current = view.chosenTick
    pulse.current?.animate(
      reduced()
        ? [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    )
  }, [view.chosenTick])

  // Level change: old icons leave (fade + shrink / grow), new ones enter with a stagger.
  const levelKey = `${view.level}|${view.levelLabel}`
  const layers = useLeaving<DialView>(levelKey, view, 220)
  const dir = layers.from && DEPTH[view.level] < DEPTH[layers.from.level] ? 'out' : 'in'

  // Centre text cross-fade
  const text = centreText(view, paused)
  const centre = useLeaving<CentreText>(`${text.level}|${text.name}|${text.hint}`, text, 160)

  return (
    <div
      className="dial"
      data-open={view.open}
      data-snap={ang.snap}
      data-paused={paused}
      data-empty={view.slots[view.highlight]?.kind === 'empty'}
      style={{ '--a': ang.a } as CSSProperties}
    >
      <div className="ring" />
      <div className="hole" />
      <div className="seg">
        <div className="seg-pulse" ref={pulse} style={{ clipPath: wedge(view.slots.length) }}>
          <div className="seg-grad" />
        </div>
        <div className="marker" />
      </div>
      {layers.leaving.map((l) => (
        <Slots key={l.id} slots={l.v.slots} highlight={-1} className={`leave-${dir}`} />
      ))}
      <Slots
        key={layers.id}
        slots={view.slots}
        highlight={view.highlight}
        className={layers.id > 0 ? `enter-${dir}` : ''}
      />
      <div className="centre">
        {centre.leaving.map((l) => (
          <CentreBlock key={l.id} t={l.v} className="fade-out" />
        ))}
        <CentreBlock key={centre.id} t={text} className={centre.id > 0 ? 'fade-in' : ''} />
      </div>
    </div>
  )
}

// ───────────────────────── level dial ─────────────────────────

// Same disc / ring / hole as the dial. The ring is the "Track Remaining" (#1c1c1c), the "Track Played" is an SVG
// stroke from the top, clockwise. Its radial gradient (Figma) is brightest at the end line and rotates with it.
const R_MID = (R_OUT + R_IN) / 2
/** Radial centre for an end at 12 o'clock: r 110.2, 1.8 deg past the end; radius 247.4. */
const GLOW = (() => { const [cx, cy] = pt(110.2, 1.8).split(' ').map(Number); return { cx, cy, r: 247.4 } })()
/** The shadow spans up to 38 % behind the end and 0.28 % (1 deg) past it. */
const SHADOW_SPAN = 38
/** The arc starts at 12 o'clock and runs clockwise. */
const START = 0
/** Full circle from START, clockwise; pathLength 100 makes dashoffset = 100 - percent. */
const ARC = `M${pt(R_MID, START)} A${R_MID} ${R_MID} 0 1 1 ${pt(R_MID, START + 180)} A${R_MID} ${R_MID} 0 1 1 ${pt(R_MID, START)}`

function LevelDial({ r, show, snap }: { r: Readout; show: boolean; snap: boolean }): JSX.Element {
  const muted = r.value === 'Muted'
  const p = muted ? 0 : Math.min(100, Math.max(0, Math.round(r.percent ?? 0)))
  const shadowEnd = Math.min(100, p + 0.28), shadowLen = p ? Math.min(SHADOW_SPAN, shadowEnd) : 0
  return (
    <div className="dial level" data-open={show} data-snap={snap}>
      <div className="ring" />
      <div className="hole" />
      <svg className="level-svg" viewBox="0 0 420 420" aria-hidden="true">
        <defs>
          <radialGradient id="lvl-grad" gradientUnits="userSpaceOnUse" {...GLOW} gradientTransform={`rotate(${p * 3.6} ${C} ${C})`}>
            <stop offset="0.085" stopColor="var(--accent-light)" />
            <stop offset="0.855" stopColor="#2c7178" />
            <stop offset="1" stopColor="var(--accent-end)" />
          </radialGradient>
          <filter id="lvl-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4.35" />
          </filter>
          <clipPath id="lvl-clip">
            <circle cx={C} cy={C} r={R_OUT} />
          </clipPath>
        </defs>
        <g clipPath="url(#lvl-clip)">
          <path
            className="level-shadow"
            d={ARC}
            pathLength={100}
            style={{ strokeDasharray: `${shadowLen} 200`, strokeDashoffset: shadowLen - shadowEnd }}
            stroke="#000"
            strokeOpacity={0.5}
            strokeWidth={R_OUT - R_IN}
            fill="none"
            filter="url(#lvl-blur)"
          />
        </g>
        <path
          className="level-arc"
          d={ARC}
          pathLength={100}
          style={{ strokeDashoffset: 100 - p }}
          stroke="url(#lvl-grad)"
          strokeWidth={R_OUT - R_IN}
          fill="none"
        />
      </svg>
      <div className="level-end" data-zero={p === 0} style={{ transform: `rotate(${START + p * 3.6}deg)` }}>
        <i className="level-edge" />
        <i className="level-dot" />
      </div>
      <div className="centre">
        <div className="centre-text">
          {muted ? <div className="lvl-muted">Muted</div> : <div className="lvl-num">{p}</div>}
          <div className="c-name">{r.label}</div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── readout ─────────────────────────

function Pill({ r, show }: { r: Readout; show: boolean }): JSX.Element {
  return (
    <div className="readout" data-show={show} data-kind={r.kind}>
      <span className="pill-icon">
        <Icon name={r.icon} size={20} />
      </span>
      <span className="pill-label">{r.label}</span>
      {r.percent !== null && (
        <span className="pill-bar">
          <span
            className="pill-fill"
            style={{ transform: `scaleX(${Math.min(100, Math.max(0, r.percent)) / 100})` }}
          />
        </span>
      )}
      {r.value && <span className="pill-value">{r.value}</span>}
    </div>
  )
}

const READOUT_MS = 1000

export function Overlay({ data }: { data: OverlayData }): JSX.Element {
  const { view, scale, paused, levelScale, levelPosition } = data
  // 3x3 anchor from the position name: grid alignment + scale origin, so the dial's and the ring's edges stay 32 px
  // from the screen edge. Pills always sit bottom-centre, above the taskbar.
  const col = levelPosition.includes('left') ? 0 : levelPosition.includes('right') ? 2 : 1
  const row = levelPosition.includes('top') ? 0 : levelPosition.includes('bottom') ? 2 : 1
  const align: CSSProperties = { justifyItems: ['start', 'center', 'end'][col], alignItems: ['start', 'center', 'end'][row] }
  // keep the last readout so it can fade out with its content
  const [shown, setShown] = useState<Readout | null>(null)
  const [visible, setVisible] = useState(false)
  // a readout that arrives while hidden sets the level arc without gliding from the old value
  const [snap, setSnap] = useState(true)
  useEffect(() => {
    if (!data.readout) {
      setVisible(false)
      return
    }
    setSnap(!visible)
    setShown(data.readout)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), data.readout.kind === 'value' && data.readout.percent !== null ? LEVEL_RING_MS : READOUT_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.readout])

  // Volume / Brightness / Mic: the level dial in the dial's place (the open dial wins). Others: the pill.
  const isLevel = shown?.kind === 'value' && shown.percent !== null
  return (
    <>
      <div className="level-layer" style={align}>
        <div className="stage" style={{ '--s': scale, transformOrigin: `${[132.3, 280, 427.7][col]}px ${[110.3, 258, 405.7][row]}px` } as CSSProperties}>
          <Dial view={view} paused={paused} />
        </div>
      </div>
      <div className="readout-slot">{shown && !isLevel && <Pill r={shown} show={visible} />}</div>
      {isLevel && (
        <div className="level-layer" style={align}>
          <div className="level-box" style={{ transform: `scale(${levelScale})`, transformOrigin: `${col * 50}% ${row * 50}%` }}>
            <LevelDial r={shown} show={visible && !view.open} snap={snap} />
          </div>
        </div>
      )}
    </>
  )
}
