import { useEffect, useRef, useState } from 'react'
import { ICON_NAMES, Icon } from '@renderer/icons/Icon'
import { Label } from '../components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { cn } from '../lib/utils'

export interface IconPickerProps {
  /** Icon file name (see icons/svg). */
  value: string
  onChange: (icon: string) => void
  /** Small label above the trigger. Default "Icon". */
  label?: string
  className?: string
}

const COLS = 8

/**
 * Icon chooser: 44 px glass field showing the current icon that opens a portaled 8-column grid.
 */
export function IconPicker({ value, onChange, label = 'Icon', className }: IconPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      grid.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const cells = Array.from(grid.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const at = cells.indexOf(document.activeElement as HTMLElement)
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }
    if (e.key in step) cells[Math.min(cells.length - 1, Math.max(0, at + step[e.key]))]?.focus()
    else if (e.key === 'Home') cells[0]?.focus()
    else if (e.key === 'End') cells[cells.length - 1]?.focus()
    else if (e.key === 'Escape') {
      setOpen(false)
      trigger.current?.focus()
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className={cn('k-iconpick flex flex-col gap-2.5 shrink-0', className)}>
      <Label className="k-label">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            type="button"
            className={cn(
              'k-iconpick__btn dc-field flex items-center gap-2 h-11 pl-3.5 pr-2.5 rounded-xl text-foreground transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:border-active-border cursor-pointer',
              open && 'border-active-border bg-[var(--k-input-hover)] hover:border-active-border'
            )}
            aria-label={`${label}: ${value}`}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <Icon name={value} size={21} />
            <Icon name="chevron-down" size={16} className="k-iconpick__chev text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.stopPropagation()
            setOpen(false)
            trigger.current?.focus()
          }}
          className={cn('w-auto p-2.5 z-[60]', trigger.current?.closest('.k-side-theme') && 'k-side-theme')}
        >
          <div
            ref={grid}
            className="k-iconpick__grid grid grid-cols-8 gap-1.5"
            role="listbox"
            aria-label={label}
            onKeyDown={onKeyDown}
          >
            {ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === value}
                aria-label={name}
                title={name}
                tabIndex={name === value ? 0 : -1}
                className={cn(
                  'k-iconpick__cell flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:border-active-border',
                  name === value
                    ? 'bg-primary/15 text-accent-foreground border-transparent'
                    : 'border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                )}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                  trigger.current?.focus()
                }}
              >
                <Icon name={name} size={20} />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
