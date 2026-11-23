import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Label above the field. */
  label?: string
  /** Error message: turns the border red and shows the text below. */
  error?: string
  /** Neutral helper text below the field (hidden while `error` is set). */
  helper?: string
}

/**
 * Single-line text input with breathable 10 px label gap, 44 px glass field, helper & error text.
 */
export function TextInput({
  value,
  onChange,
  label,
  error,
  helper,
  disabled,
  className,
  id,
  ...rest
}: TextInputProps): React.JSX.Element {
  const auto = useId()
  const inputId = id ?? auto
  const note = error ?? helper
  return (
    <div
      className={cn(
        'k-field flex flex-col gap-2.5 min-w-0',
        error && 'k-field--error',
        disabled && 'k-field--disabled',
        className
      )}
    >
      {label && (
        <Label htmlFor={inputId} className="k-label">
          {label}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(
          'k-field__input',
          error && 'border-destructive/75 hover:border-destructive focus-visible:border-destructive'
        )}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={note ? `${inputId}-note` : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {note && (
        <span
          id={`${inputId}-note`}
          className={cn('k-field__helper text-[13px] leading-snug', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {note}
        </span>
      )}
    </div>
  )
}
