import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { Button as ShadcnButton } from '../components/ui/button'
import { cn } from '../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = teal gradient glass fill, secondary = frosted glass fill (default), ghost = text only, danger = red tint. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Optional leading icon name (see icons/svg), drawn at 18 px. */
  icon?: string
  /** Button size scale (default = 44 px, sm = 36 px, lg = 48 px). */
  size?: 'default' | 'sm' | 'lg'
}

const VARIANT_MAP = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive'
} as const

/**
 * DesignCode UI text button (44 px default, 20 px horizontal padding, 14 px font).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'default', icon, className, children, type = 'button', ...rest }, ref) => (
    <ShadcnButton
      ref={ref}
      type={type}
      variant={VARIANT_MAP[variant]}
      size={size}
      className={cn('k-btn', `k-btn--${variant}`, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </ShadcnButton>
  )
)
Button.displayName = 'Button'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string
  /** Required accessible name, e.g. "Close". */
  label: string
  /** Selected look (clean single light colored stroke), also sets aria-pressed. */
  selected?: boolean
  iconSize?: number
}

/**
 * 36 px square icon-only button.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, selected, iconSize = 18, className, type = 'button', ...rest }, ref) => (
    <ShadcnButton
      ref={ref}
      type={type}
      variant="ghost"
      size="icon"
      className={cn(
        'k-iconbtn',
        selected && 'bg-primary/16 text-accent-foreground border-transparent hover:bg-primary/22 hover:text-accent-foreground',
        className
      )}
      aria-label={label}
      title={label}
      aria-pressed={selected === undefined ? undefined : selected}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </ShadcnButton>
  )
)
IconButton.displayName = 'IconButton'
