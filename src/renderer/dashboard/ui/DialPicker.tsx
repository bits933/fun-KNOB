import type { DialView } from '@shared/types'
import { cx } from './cx'
import { DialPreview } from './DialPreview'

export interface DialPickerProps {
  /** The dial to draw (4–8 slots). Its `highlight` is ignored; `selected` drives it. */
  view: DialView
  /** Rendered diameter in px. */
  size: number
  /** 0-7, or null for "nothing selected" (no green segment, no centre name). */
  selected: number | null
  onSelect: (slot: number) => void
  /** Accessible name of the group, e.g. "Photoshop dial". */
  'aria-label': string
  className?: string
  /** Passed to DialPreview: where each slot sits (degrees from the top), which one is lifted, and snap (no slide). */
  angles?: number[]
  lifted?: number | null
  snap?: boolean
}

const R_ICON = 158 // same geometry as DialPreview (600 px artwork)
const HIT = 92 // hit-circle diameter in artwork px

/**
 * An interactive `DialPreview`: round hit areas sit over the slot icons. Click or Tab + Enter / Space picks a slot,
 * the green segment glides to it. `<DialPicker view={view} size={410} selected={slot} onSelect={setSlot} aria-label="Main dial" />`
 */
export function DialPicker({ view, size, selected, onSelect, className, angles, lifted, snap, ...aria }: DialPickerProps): React.JSX.Element {
  const k = size / 600
  const d = HIT * k
  const r = R_ICON * k
  return (
    <div className={cx('k-dialpick', selected === null && 'k-dialpick--none', snap && 'k-dialpick--snap', className)} style={{ width: size, height: size }} role="group" aria-label={aria['aria-label']}>
      <DialPreview view={{ ...view, highlight: selected ?? 0, hint: null }} size={size} angles={angles} lifted={lifted} snap={snap} />
      {view.slots.map((s, i) => (
        // Round hit area parked at the top and turned round the centre, so it slides with its icon.
        <button
          key={i}
          type="button"
          className="k-dialpick__hit"
          aria-label={`Slot ${i + 1}: ${s.name}`}
          aria-pressed={selected === i}
          style={{ width: d, height: d, left: size / 2 - d / 2, top: size / 2 - r - d / 2, transformOrigin: `50% ${r + d / 2}px`, transform: `rotate(${angles?.[i] ?? i * 360 / view.slots.length}deg)` }}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}
