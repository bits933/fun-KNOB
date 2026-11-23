import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl font-medium transition-[background-color,color,border-color,filter,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(180deg,#39695a_0%,#245b52_100%)] text-white border border-white/[0.10] hover:brightness-110',
        secondary:
          'bg-secondary border border-border-strong text-secondary-foreground hover:bg-secondary-hover hover:border-white/[0.14]',
        outline:
          'border border-white/[0.08] bg-white/[0.025] text-foreground/95 hover:bg-white/[0.065] hover:border-white/[0.13]',
        ghost:
          'border border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.055] hover:text-foreground',
        destructive:
          'bg-destructive/[0.10] text-destructive border border-destructive/20 hover:bg-destructive/[0.16] hover:border-destructive/35',
        destructiveSolid:
          'bg-[linear-gradient(180deg,#e77068_0%,#d0534b_100%)] text-white border border-white/[0.10] hover:brightness-110'
      },
      size: {
        default: 'h-11 px-5 text-[14px]',
        sm: 'h-9 px-3.5 text-[13.5px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9 p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
