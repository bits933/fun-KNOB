import type { HTMLAttributes, ReactNode } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { cn } from '../lib/utils'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Section label (14 px semibold, muted) so the card's content leads. Omit for no header row. */
  title?: ReactNode
  /** Optional subtitle below the card title. */
  description?: ReactNode
  /** Small teal text action on the right of the header, e.g. `{ label: 'Edit', onClick }`. */
  action?: { label: string; onClick: () => void }
  /** Any node on the right of the header (e.g. a ghost Button) instead of `action`. */
  headerRight?: ReactNode
}

/**
 * DesignCode UI Dark Glass surface with 24 px padding, luminous inner-edge rim and 20 px radius.
 * Children are laid out in a column (gap 20).
 */
export function Card({ title, description, action, headerRight, className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <section
      className={cn(
        'k-card dc-glass flex flex-col gap-5 min-w-0 p-6 text-card-foreground rounded-[20px]',
        className
      )}
      {...rest}
    >
      {(title || description || action || headerRight) && (
        <header className="k-card__head flex items-center justify-between gap-4 min-h-[24px]">
          <div className="min-w-0">
            {title && <h2 className="k-card__title m-0 text-[13.5px] font-medium leading-snug tracking-[0.005em] text-muted-foreground">{title}</h2>}
            {description && <p className="m-0 mt-1 text-[13px] text-subtle-foreground">{description}</p>}
          </div>
          {action && (
            <button
              type="button"
              className="k-card__action shrink-0 -my-1 px-3 h-8 rounded-lg text-[13px] font-medium text-accent-foreground hover:bg-primary/15 transition-colors cursor-pointer focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-0"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}
          {headerRight}
        </header>
      )}
      {children}
    </section>
  )
}

/** Column that sits inside a Card (or anywhere) with the card-body spacing of 10 px. */
export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('k-card__body flex flex-col gap-2.5 min-w-0', className)} {...rest} />
}

/**
 * Screen title (28 px semibold) with a breathable description under it and an optional right-hand slot.
 */
export function PageHeader({
  title,
  description,
  side,
  className
}: {
  title: string
  description?: string
  side?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <header className={cn('k-page flex items-start justify-between gap-5', className)}>
      <div className="min-w-0">
        <h1 className="k-page__title m-0 text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="k-page__desc mt-1.5 mb-0 text-[14px] font-normal leading-snug text-muted-foreground">{description}</p>}
      </div>
      {side && <div className="k-page__side self-center flex items-center gap-3 shrink-0">{side}</div>}
    </header>
  )
}

/**
 * Amber glass notice bar (used for "paused" or missing-app alerts).
 */
export function Banner({
  icon = 'warning',
  action,
  children,
  className
}: {
  icon?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'k-banner flex items-center gap-4 px-5 py-3.5 border border-warning/22 bg-warning/[0.08] backdrop-blur-md rounded-2xl',
        className
      )}
      role="status"
    >
      <Icon name={icon} size={22} className="k-banner__icon shrink-0 text-warning" />
      <div className="k-banner__text flex-1 min-w-0 text-[14px] text-foreground">{children}</div>
      {action}
    </div>
  )
}
