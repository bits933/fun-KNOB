import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { Popover, PopoverAnchor, PopoverContent } from '../components/ui/popover'
import { cn } from '../lib/utils'

export interface Option<T extends string = string> {
  value: T
  label: string
  /** Optional leading visual (e.g. an app icon), shown in the field and in the menu. */
  lead?: React.ReactNode
  accent?: boolean
}

export interface DropdownProps<T extends string = string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /** When open, the field turns into a search box that filters the options by label. */
  searchable?: boolean
  /** Shown in the field when no option matches value. */
  placeholder?: string
  /** Placeholder of the search box. */
  searchPlaceholder?: string
  /** Accessible name. */
  'aria-label': string
  /** `lg` = 54 px field with larger text. */
  size?: 'default' | 'lg'
  className?: string
}

/** Twinkling stars behind an accent option: position, size and stagger. */
const STARS = [
  [12, 28, 3, 0], [24, 66, 2, 1.1], [36, 30, 3, 0.5], [47, 62, 2, 1.7], [58, 26, 3, 0.9], [69, 64, 2, 2.1]
].map(([x, y, s, d]) => ({ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s` }) as React.CSSProperties)

/**
 * DesignCode UI single-choice dropdown (44 px field, 16 px padding, 14.5 px text, single light active stroke).
 */
export function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  disabled,
  placeholder = '',
  searchable,
  searchPlaceholder = 'Search',
  size = 'default',
  className,
  ...aria
}: DropdownProps<T>): React.JSX.Element {
  const lg = size === 'lg'
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])

  const openMenu = (): void => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const close = (): void => {
    setOpen(false)
    if (searchable) setTimeout(() => button.current?.focus())
  }

  const pick = (i: number): void => {
    if (!shown[i]) return
    onChange(shown[i].value)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') setActive((a) => Math.min(shown.length - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Home' && !searchable) setActive(0)
    else if (e.key === 'End' && !searchable) setActive(shown.length - 1)
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) pick(active)
    else if (e.key === 'Tab') {
      setOpen(false)
      return
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else return
    e.preventDefault()
  }

  const combo = {
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': `${id}-menu`,
    'aria-activedescendant': open && shown[active] ? `${id}-${active}` : undefined,
    'aria-label': aria['aria-label'],
    onKeyDown
  } as const

  const inSideTheme = Boolean(root.current?.closest('.k-side-theme'))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false)
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={root}
          className={cn('k-dd relative min-w-0', open && 'k-dd--open', disabled && 'k-dd--disabled opacity-45', className)}
        >
          {open && searchable ? (
            <div
              className={cn(
                'k-dd__field flex items-center w-full border border-active-border bg-[var(--k-input-hover)]',
                lg ? 'h-[54px] px-4.5 gap-3.5 text-[15.5px] font-medium rounded-[14px]' : 'h-11 px-4 gap-3 text-[14.5px] rounded-xl'
              )}
            >
              <Icon name="search" size={18} className="k-dd__chev shrink-0 text-muted-foreground" />
              <input
                {...combo}
                autoFocus
                className="k-dd__input flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-foreground placeholder:text-subtle-foreground select-text"
                aria-autocomplete="list"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
              />
            </div>
          ) : (
            <button
              {...combo}
              ref={button}
              type="button"
              className={cn(
                'k-dd__field dc-field flex items-center w-full text-left text-foreground transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:border-active-border cursor-pointer disabled:cursor-not-allowed',
                lg ? 'h-[54px] px-4.5 gap-3.5 text-[15.5px] font-medium rounded-[14px]' : 'h-11 px-4 gap-3 text-[14.5px] rounded-xl',
                open && 'border-active-border bg-[var(--k-input-hover)] hover:border-active-border'
              )}
              disabled={disabled}
              onClick={() => (open ? setOpen(false) : openMenu())}
            >
              {current?.lead && <span className={cn('k-dd__lead inline-flex shrink-0', current.accent && 'k-accent-ink')}>{current.lead}</span>}
              <span
                className={cn(
                  'k-dd__value flex-1 min-w-0 truncate',
                  !current && 'text-subtle-foreground'
                )}
                data-placeholder={!current}
              >
                {current?.accent ? <span className="k-accent-text">{current.label}</span> : current?.label ?? placeholder}
              </span>
              <Icon
                name="chevron-down"
                size={18}
                className={cn(
                  'k-dd__chev shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
                  open && 'rotate-180'
                )}
              />
            </button>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        sideOffset={6}
        collisionPadding={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (root.current?.contains(e.target as Node)) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          close()
        }}
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        className={cn('p-1.5 z-[60]', inSideTheme && 'k-side-theme')}
      >
        <ul
          id={`${id}-menu`}
          className="k-dd__menu flex flex-col gap-0.5 m-0 p-0 list-none max-h-[280px] overflow-y-auto overscroll-contain"
          role="listbox"
        >
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              className={cn(
                'k-dd__option flex items-center rounded-[10px] cursor-pointer select-none transition-colors duration-100 shrink-0',
                lg ? 'h-12 px-4 gap-3.5 text-[14.5px]' : 'h-10 px-3.5 gap-3 text-[14px]',
                o.accent
                  ? 'k-dd__option--accent relative isolate overflow-hidden'
                  : i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.045]',
                o.value === value && 'font-medium',
                !o.accent && (o.value === value ? 'text-accent-foreground' : 'text-foreground')
              )}
              aria-selected={o.value === value}
              data-active={i === active}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
            >
              {o.accent && (
                <span className="k-dd__stars" aria-hidden="true">
                  {STARS.map((s, k) => <i key={k} className="k-dd__star" style={s} />)}
                </span>
              )}
              {o.lead && <span className={cn('k-dd__lead inline-flex shrink-0', o.accent && 'k-accent-ink')}>{o.lead}</span>}
              <span className="k-dd__value flex-1 min-w-0 truncate">{o.accent ? <span className="k-accent-text">{o.label}</span> : o.label}</span>
              {o.value === value && <Icon name="check" size={16} className={cn('shrink-0', o.accent ? 'k-accent-ink' : 'text-accent-foreground')} />}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="k-dd__empty px-3.5 py-2.5 text-[14px] text-subtle-foreground" aria-disabled="true">
              No matches
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
