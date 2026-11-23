import type { ReactNode } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { cn } from '../lib/utils'

export interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  /** warning = amber icon tile (error states). Default neutral. */
  tone?: 'neutral' | 'warning'
  /** Draw it inside a raised glass card (the "App not found" look). */
  card?: boolean
  /** Buttons, centred under the text. */
  children?: ReactNode
  className?: string
}

/**
 * Centred placeholder: 64 px frosted icon well, heading, breathable description, buttons.
 */
export function EmptyState({
  icon,
  title,
  description,
  tone = 'neutral',
  card,
  children,
  className
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'k-empty flex flex-col items-center justify-center gap-5 flex-1 min-h-0 text-center p-8',
        card && 'k-empty--card dc-glass rounded-[20px]',
        className
      )}
    >
      <span
        className={cn(
          'k-empty__tile flex items-center justify-center w-16 h-16 rounded-2xl border',
          tone === 'warning'
            ? 'k-empty__tile--warn bg-warning/12 border-warning/22 text-warning'
            : 'bg-white/[0.04] border-white/[0.07] text-muted-foreground'
        )}
      >
        <Icon name={icon} size={tone === 'warning' ? 30 : 28} />
      </span>
      <div className="k-empty__text flex flex-col items-center gap-2">
        <h2 className="k-empty__title m-0 text-[18px] font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
        {description && <p className="k-empty__desc m-0 max-w-[380px] text-[14px] text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {children && <div className="k-empty__actions flex items-center gap-3 mt-1">{children}</div>}
    </div>
  )
}
