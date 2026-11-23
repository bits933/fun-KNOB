import { cn } from '../lib/utils'

export const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const
export type Position = (typeof POSITIONS)[number]
const label = (p: string): string => p.replace('-', ' ').replace(/^./, (c) => c.toUpperCase())

/**
 * 3x3 alignment picker (84 px glass box). Radiogroup; arrow keys move the choice across the grid.
 */
export function PositionGrid({
  value,
  onChange,
  className,
  ...aria
}: {
  value: Position
  onChange: (p: Position) => void
  'aria-label': string
  className?: string
}): React.JSX.Element {
  const i = POSITIONS.indexOf(value)
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!dx && !dy) return
    e.preventDefault()
    const x = Math.min(2, Math.max(0, (i % 3) + dx))
    const y = Math.min(2, Math.max(0, Math.floor(i / 3) + dy))
    onChange(POSITIONS[y * 3 + x])
    ;(e.currentTarget.children[y * 3 + x] as HTMLElement).focus()
  }
  return (
    <div
      className={cn(
        'k-posgrid dc-field grid grid-cols-3 w-[84px] h-[84px] shrink-0 p-1 rounded-xl',
        className
      )}
      role="radiogroup"
      aria-label={aria['aria-label']}
      onKeyDown={onKeyDown}
    >
      {POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === value}
          aria-label={label(p)}
          tabIndex={p === value ? 0 : -1}
          className="k-posgrid__cell"
          onClick={() => onChange(p)}
        />
      ))}
    </div>
  )
}
