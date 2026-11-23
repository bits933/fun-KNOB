import { useRef } from 'react'
import { cn } from '../lib/utils'
import type { Option } from './Dropdown'

export interface SegmentedControlProps<T extends string = string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Accessible name of the group. */
  'aria-label': string
  className?: string
}

/**
 * DesignCode UI equal-width glass segmented control (44 px total height, 36 px pills, elevated inner-glow thumb).
 */
export function SegmentedControl<T extends string = string>({
  value,
  options,
  onChange,
  className,
  ...aria
}: SegmentedControlProps<T>): React.JSX.Element {
  const found = options.findIndex((o) => o.value === value)
  const index = Math.max(0, found)
  // Sticky direction of the last move, so the thumb stretches toward where it's going.
  const move = useRef({ index, dir: 1 })
  if (move.current.index !== index) move.current = { index, dir: index > move.current.index ? 1 : -1 }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = found < 0 ? (d > 0 ? 0 : options.length - 1) : (index + d + options.length) % options.length
    onChange(options[next].value)
    ;(e.currentTarget.querySelectorAll('button')[next] as HTMLElement | undefined)?.focus()
  }
  return (
    <div
      className={cn(
        'k-seg relative flex gap-1 p-1 rounded-[14px] bg-[var(--k-seg-track)] border border-[var(--k-border)]',
        className
      )}
      role="radiogroup"
      aria-label={aria['aria-label']}
      data-none={found < 0}
      data-dir={move.current.dir}
      style={{ ['--n' as string]: options.length, ['--i' as string]: index }}
      onKeyDown={onKeyDown}
    >
      <span className="k-seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (found < 0 && o === options[0]) ? 0 : -1}
          className={cn(
            'k-seg__opt relative flex-1 min-w-0 h-9 px-3 truncate border-0 rounded-[10px] bg-transparent text-[13.5px] transition-colors duration-150 cursor-pointer focus-visible:outline-1 focus-visible:outline-active-border',
            o.value === value ? 'text-foreground font-medium' : 'text-muted-foreground font-normal hover:text-foreground/90'
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
