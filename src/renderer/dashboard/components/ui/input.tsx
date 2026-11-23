import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'dc-field flex h-11 w-full rounded-xl px-4 text-[14.5px] text-foreground placeholder:text-subtle-foreground caret-foreground transition-[background-color,border-color] duration-150 focus:outline-none focus:border-active-border focus:hover:border-active-border focus:bg-[var(--k-input-hover)] disabled:cursor-not-allowed disabled:opacity-45 select-text',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
