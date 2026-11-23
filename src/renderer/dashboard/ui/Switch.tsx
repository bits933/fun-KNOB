import { Switch as ShadcnSwitch } from '../components/ui/switch'
import { cn } from '../lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
  /** Accessible name (visible text usually sits next to the switch). */
  label: string
  className?: string
}

/**
 * On/off switch, 40x22, backed by Radix Switch.
 * `<Switch label="Start with Windows" checked={v} onChange={setV} />`
 */
export function Switch({ checked, onChange, disabled, label, className }: SwitchProps): React.JSX.Element {
  return (
    <ShadcnSwitch
      checked={checked}
      onCheckedChange={(next) => onChange?.(next)}
      disabled={disabled}
      aria-label={label}
      className={cn('k-switch', className)}
    />
  )
}
