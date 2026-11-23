import { Slider as ShadcnSlider } from '../components/ui/slider'
import { cn } from '../lib/utils'

export interface SliderProps {
  /** Text on the left of the header row. Omit (and pass `aria-label`) for a bare track. */
  label?: string
  value: number
  min: number
  max: number
  step?: number
  stops?: boolean
  /** Called on every drag / key step with the new value (already snapped to `step`). */
  onChange: (value: number) => void
  /** Text shown on the right of the header, e.g. `v => (v / 1000).toFixed(2) + ' s'`. Defaults to the number. */
  format?: (value: number) => string
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

/**
 * Slider with readable 14 px label + tabular value readout backed by the capsule pill slider.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  stops,
  onChange,
  format,
  disabled,
  className,
  ...aria
}: SliderProps): React.JSX.Element {
  const text = format ? format(value) : String(value)
  return (
    <div className={cn('k-slider flex flex-col gap-3 min-w-0', disabled && 'k-slider--disabled opacity-45', className)}>
      {label !== undefined && (
        <div className="k-slider__head flex items-center justify-between gap-3 text-[14px]">
          <span className="font-medium text-foreground">{label}</span>
          <span className="k-slider__value text-muted-foreground tabular-nums font-medium">{text}</span>
        </div>
      )}
      <ShadcnSlider
        value={[value]}
        min={min}
        max={max}
        step={step}
        stops={stops}
        disabled={disabled}
        aria-label={aria['aria-label'] ?? label}
        onValueChange={([v]) => {
          if (v !== undefined && v !== value) onChange(v)
        }}
      />
    </div>
  )
}
