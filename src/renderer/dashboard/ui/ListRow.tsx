import { useLayoutEffect, useRef, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { Badge as UiBadge } from '../components/ui/badge'
import { cn } from '../lib/utils'

export type BadgeType = 'active' | 'empty' | 'not-found' | 'running'

const BADGE_TEXT: Record<BadgeType, string> = {
  active: 'Active',
  empty: 'Empty',
  'not-found': 'Not found',
  running: 'Running'
}

const BADGE_VARIANT: Record<BadgeType, 'default' | 'secondary' | 'warning' | 'running'> = {
  active: 'default',
  empty: 'secondary',
  'not-found': 'warning',
  running: 'running'
}

/**
 * Status pill with generous padding: `active` / `running` (teal), `empty` (slate), `not-found` (amber).
 */
export function Badge({ type, children, className }: { type: BadgeType; children?: ReactNode; className?: string }): React.JSX.Element {
  return (
    <UiBadge variant={BADGE_VARIANT[type]} className={cn('k-badge', `k-badge--${type}`, className)}>
      {type === 'running' && <span className="k-badge__dot w-2 h-2 rounded-full bg-accent-foreground" />}
      {children ?? BADGE_TEXT[type]}
    </UiBadge>
  )
}

export interface ListRowProps {
  /** Icon name for the 40 px round tile on the left. */
  icon?: string
  /** Replaces the icon tile (e.g. an app logo). */
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** chevron = arrow, or any node (Switch, Badge, Button …). */
  trailing?: 'chevron' | ReactNode
  /** Makes the row a button (hover / pressed / keyboard Enter + Space). Omit for display-only rows. */
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  /** Red outline + red subtitle (e.g. "App not found"). */
  error?: boolean
  /** No horizontal padding (when the row sits flush inside a card). */
  flush?: boolean
  className?: string
}

/**
 * Breathable list row (62 px): frosted icon well, clear 14.5 px title + 13 px subtitle, trailing control.
 */
export function ListRow({
  icon,
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  selected,
  disabled,
  error,
  flush,
  className
}: ListRowProps): React.JSX.Element {
  const interactive = !!onClick && !disabled
  const props: HTMLAttributes<HTMLDivElement> = interactive
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }
      }
    : {}
  return (
    <div
      className={cn(
        'k-row relative flex items-center gap-3.5 min-h-[62px] px-3.5 py-2.5 border rounded-2xl transition-[background-color,border-color] duration-150',
        flush && 'k-row--flush px-0 py-3 min-h-[60px]',
        interactive && 'k-row--click cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.06] focus-visible:outline-none focus-visible:border-active-border',
        selected && 'bg-white/[0.06] border-transparent hover:bg-white/[0.075]',
        disabled && 'k-row--disabled opacity-45 pointer-events-none',
        error ? 'k-row--error border-destructive/55 bg-destructive/[0.05]' : 'border-transparent',
        className
      )}
      data-selected={selected ? 'true' : undefined}
      aria-disabled={disabled || undefined}
      aria-current={selected ? 'true' : undefined}
      {...props}
    >
      {leading ?? (
        icon && (
          <span
            className={cn(
              'k-row__lead flex items-center justify-center shrink-0 w-10 h-10 rounded-xl border transition-colors',
              selected
                ? 'bg-primary/15 border-transparent text-accent-foreground'
                : 'bg-white/[0.04] border-white/[0.06] text-muted-foreground'
            )}
          >
            <Icon name={icon} size={20} />
          </span>
        )
      )}
      <span className="k-row__text flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="k-row__title text-[14.5px] font-medium leading-snug text-foreground truncate">{title}</span>
        {subtitle && (
          <span className={cn('k-row__sub text-[13px] font-normal leading-snug truncate', error ? 'text-destructive' : 'text-muted-foreground')}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing && (
        <span className="k-row__trail shrink-0 flex items-center text-muted-foreground">
          {trailing === 'chevron' ? <Icon name="chevron-right" size={20} /> : trailing}
        </span>
      )}
      <span className="k-row__bar" aria-hidden="true" />
    </div>
  )
}

/** Vertical stack of ListRows. The selected row's teal bar glides to the new row on change. */
export function ListGroup({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [y, setY] = useState<number | null>(null)
  useLayoutEffect(() => {
    const sel = ref.current?.querySelector<HTMLElement>('[data-selected="true"]')
    const next = sel ? sel.offsetTop + (sel.offsetHeight - 24) / 2 : null
    setY((prev) => (prev === next ? prev : next))
  })
  return (
    <div ref={ref} className={cn('k-listgroup relative flex flex-col', className)}>
      <span
        className={cn('k-listgroup__bar', y !== null && 'k-listgroup__bar--on')}
        style={{ ['--y' as string]: `${y ?? 0}px` }}
        aria-hidden="true"
      />
      {children}
    </div>
  )
}

export interface MacroStepRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon for the step type: keyboard, type-text, open, wait. */
  icon: string
  /** Step type text, e.g. "Press", "Type", "Open", "Wait". */
  type: string
  /** Step content, e.g. "Ctrl + Shift + S". */
  value: ReactNode
  /** Drag look (clean lighter colored stroke, elevation). Hover look is automatic. */
  dragging?: boolean
  onDelete?: () => void
  /** Spread on the grip so the parent can attach drag handlers. */
  gripProps?: HTMLAttributes<HTMLSpanElement>
}

/** One step of a macro (56 px): grip, step icon, "Press  Ctrl + Shift + S", delete button. */
export function MacroStepRow({
  icon,
  type,
  value,
  dragging,
  onDelete,
  gripProps,
  className,
  ...rest
}: MacroStepRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'k-step flex items-center gap-3.5 h-14 pl-4 pr-2.5 border rounded-2xl text-muted-foreground transition-[background-color,box-shadow,border-color] duration-150',
        dragging
          ? 'k-step--dragging bg-[#141822] border-active-border shadow-xl'
          : 'bg-[#0b0e14] border-white/[0.065] hover:bg-[#0f131b] hover:border-white/[0.11] focus-within:bg-[#0f131b]',
        className
      )}
      {...rest}
    >
      <span className="k-step__grip cursor-grab flex text-subtle-foreground hover:text-foreground" {...gripProps}>
        <Icon name="grip" size={20} />
      </span>
      <Icon name={icon} size={20} className="shrink-0" />
      <span className="k-step__body flex-1 min-w-0 flex items-center gap-2.5 text-[14px]">
        <span className="k-step__type text-muted-foreground">{type}</span>
        <span className="k-step__value font-medium text-foreground truncate">{value}</span>
      </span>
      {onDelete && (
        <button
          type="button"
          className="k-iconbtn inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer focus-visible:outline-1 focus-visible:outline-active-border"
          aria-label="Delete step"
          title="Delete step"
          onClick={onDelete}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </div>
  )
}
