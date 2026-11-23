import { useId, useRef } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import type { DialView, Readout } from '@shared/types'
import { nextAngle } from '../../overlay/angle'
import { cx } from './cx'

const C = 300 // centre of the 600 px Figma dial
const R_OUT = 211
const R_IN = 111
const R_ICON = 158

const pt = (r: number, deg: number): string => {
  const a = (deg * Math.PI) / 180
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`
}
const highlightPath = (n: number): string => { const HALF = 17 * 8 / n; return `M ${pt(R_OUT, -90 - HALF)} A ${R_OUT} ${R_OUT} 0 0 1 ${pt(R_OUT, -90 + HALF)} L ${pt(R_IN, -90 + HALF)} A ${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, -90 - HALF)} Z` }

export interface DialPreviewProps {
  view: DialView
  /** Rendered diameter in px. The artwork is the 600 px Figma dial scaled down. Default 460 (Home). */
  size?: number
  className?: string
  /** Where each slot sits, in degrees clockwise from the top. Default: evenly spaced in order. Changing it slides icons round the ring. */
  angles?: number[]
  /** Slot whose icon is hidden because a drag lifted it off the ring. */
  lifted?: number | null
  /** Jump to `angles` without sliding (one frame, after a drag commits). */
  snap?: boolean
}

/**
 * Static picture of a dial from a `DialView` (what Figma calls the "Dial" component): grey ring with a black centre,
 * 4–8 slot icons, the highlighted segment with its marker (it glides when `view.highlight` changes), the
 * highlighted slot's name in the centre, and a small dot on the active function. Not interactive.
 * `<DialPreview view={view} size={460} />`
 */
export function DialPreview({ view, size = 460, className, angles, lifted = null, snap = false }: DialPreviewProps): React.JSX.Element {
  const gid = useId()
  const hl = view.highlight
  const n = view.slots.length
  const at = (i: number): number => angles?.[i] ?? i * 360 / n
  // Keep an unwrapped angle so the segment takes the short way round when going 7 -> 0.
  const acc = useRef({ n, angle: at(hl) })
  if (angles) acc.current.angle += ((((at(hl) - acc.current.angle) % 360) + 540) % 360) - 180
  else acc.current.angle = acc.current.n === n ? nextAngle(acc.current.angle, hl, view.slots.map(() => true)) : hl * 360 / n
  acc.current.n = n
  const slot = view.slots[hl]
  return (
    <div className={cx('k-dial', snap && 'k-dial--snap', className)} style={{ width: size, height: size }} role="img" aria-label={slot ? `Dial, ${slot.name} selected` : 'Dial'}>
      <div className="k-dial__stage" style={{ transform: `scale(${size / 600})` }}>
        <svg className="k-dial__svg" width="600" height="600" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <linearGradient id={`${gid}-g`} gradientUnits="userSpaceOnUse" x1="219.4" y1="89" x2="380.6" y2="511">
              <stop offset="0" stopColor="var(--accent-start)" />
              <stop offset="0.54" stopColor="var(--accent-mid)" />
              <stop offset="1" stopColor="var(--accent-end)" />
            </linearGradient>
          </defs>
          <circle cx={C} cy={C} r={R_IN} fill="var(--surface-base)" />
          <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none" stroke="var(--surface-ring)" strokeWidth={R_OUT - R_IN} />
          <g className="k-dial__hl" style={{ transform: `rotate(${acc.current.angle}deg)` }}>
            <path d={highlightPath(n)} fill={`url(#${gid}-g)`} />
            <polygon points="300,107.5 305,116.5 295,116.5" fill="var(--text-primary)" />
          </g>
        </svg>
        {view.slots.map((s, i) => {
          const kind = s.kind === 'empty' ? 'empty' : s.missing ? 'missing' : i === hl ? 'hl' : ''
          // The arm turns round the centre; the upright span turns back so the icon never tilts while it slides.
          return (
            <span key={i} className="k-dial__slot" data-lifted={lifted === i || undefined} style={{ transform: `rotate(${at(i)}deg)` }}>
              <span className="k-dial__upright" style={{ top: -R_ICON - 14, transform: `rotate(${-at(i)}deg)` }}>
                <span className={cx('k-dial__icon', kind && `k-dial__icon--${kind}`)}><SlotIcon slot={s} size={28} zoom={1.5} /></span>
              </span>
              {s.active && <span className="k-dial__active" style={{ top: -(R_ICON - 28) - 3 }} />}
            </span>
          )
        })}
        <div className="k-dial__centre">
          {view.levelLabel && <span className="k-dial__level">{view.levelLabel}</span>}
          <span className="k-dial__name">{slot?.name}</span>
          {view.hint && <span className="k-dial__hint">{view.hint}</span>}
        </div>
      </div>
    </div>
  )
}

/**
 * The pill shown after a turn (Figma "Dial / Readout"). Icon + label, then a value bar and/or value text.
 * Pass a `Readout` straight from `onReadout`. kind: value (white icon), message (teal icon), warning (amber icon).
 */
export function ReadoutPill({ readout, className }: { readout: Readout; className?: string }): React.JSX.Element {
  return (
    <div className={cx('k-pill', `k-pill--${readout.kind}`, className)}>
      <span className="k-pill__icon"><Icon name={readout.icon} size={20} /></span>
      <span className="k-pill__label">{readout.label}</span>
      {readout.percent !== null && (
        <span className="k-pill__bar"><span className="k-pill__fill" style={{ ['--p' as string]: Math.min(1, Math.max(0, readout.percent / 100)) }} /></span>
      )}
      {readout.value && <span className="k-pill__value">{readout.value}</span>}
    </div>
  )
}
