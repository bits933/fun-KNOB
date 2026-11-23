import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-2 h-7 px-3.5 rounded-full text-[12.5px] font-medium tracking-[0.01em] whitespace-nowrap shrink-0 transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-accent-foreground border border-transparent',
        secondary: 'bg-white/[0.055] text-muted-foreground border border-white/[0.075]',
        outline: 'border border-white/[0.09] text-foreground/95 bg-white/[0.025]',
        destructive: 'bg-destructive/15 text-destructive border border-destructive/25',
        warning: 'bg-warning/15 text-warning border border-warning/25',
        running: 'bg-primary/15 text-accent-foreground border border-transparent'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
