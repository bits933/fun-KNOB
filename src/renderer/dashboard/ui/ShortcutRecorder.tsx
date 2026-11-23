import { useEffect, useState } from 'react'
import { codeToKey, keyLabel, normalizeKeys } from '@shared/keys'
import type { KeyName } from '@shared/types'
import { cn } from '../lib/utils'
import { Icon } from '@renderer/icons/Icon'
import { IconButton } from './Button'

/** Tactile key cap pill with generous padding and clean crisp corners. */
export function KeyChip({ keyName }: { keyName: KeyName }): React.JSX.Element {
  return (
    <kbd className="k-key inline-flex items-center justify-center min-w-[30px] h-7 px-2.5 rounded-md bg-[var(--k-secondary)] border border-[var(--k-border-strong)] font-mono text-[12.5px] font-medium tracking-wide text-foreground">
      {keyLabel(keyName)}
    </kbd>
  )
}

/** A row of key caps for a combination, e.g. `<KeyCombo keys={['Ctrl','Shift','[']} />`. */
export function KeyCombo({ keys }: { keys: KeyName[] }): React.JSX.Element {
  return (
    <span className="k-keys inline-flex items-center gap-1.5 flex-wrap">
      {keys.map((k) => (
        <KeyChip key={k} keyName={k} />
      ))}
    </span>
  )
}

export interface ShortcutRecorderProps {
  /** Recorded combination (modifiers first), or null / [] when empty. */
  value: KeyName[] | null
  /** Called with a normalised combination once a non-modifier key is pressed. */
  onChange: (keys: KeyName[]) => void
  /** Shows a clear (x) button when a value exists. For optional shortcuts such as "click". */
  onClear?: () => void
  /** Error text under the field, e.g. "Already used by Brush size". Turns the border red. */
  conflict?: string | null
  placeholder?: string
  disabled?: boolean
  'aria-label': string
  className?: string
}

function heldModifiers(e: KeyboardEvent): KeyName[] {
  const m: KeyName[] = []
  if (e.ctrlKey) m.push('Ctrl')
  if (e.shiftKey) m.push('Shift')
  if (e.altKey) m.push('Alt')
  if (e.metaKey) m.push('Win')
  return m
}

const MODS = ['Ctrl', 'Shift', 'Alt', 'Win']

/**
 * Captures a key combination inside a spacious 46 px single-stroke glass field.
 */
export function ShortcutRecorder({
  value,
  onChange,
  onClear,
  conflict,
  placeholder = 'Click, then press keys',
  disabled,
  className,
  ...aria
}: ShortcutRecorderProps): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [held, setHeld] = useState<KeyName[]>([])
  const has = !!value && value.length > 0

  useEffect(() => {
    if (!recording) return
    const down = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      if (e.code === 'Escape' && heldModifiers(e).length === 0) {
        setRecording(false)
        return
      }
      const mods = heldModifiers(e)
      const key = codeToKey(e.code)
      if (!key) return
      if (MODS.includes(key)) {
        setHeld(mods)
        return
      }
      onChange(normalizeKeys([...mods, key]))
      setRecording(false)
    }
    const up = (e: KeyboardEvent): void => {
      e.preventDefault()
      setHeld(heldModifiers(e))
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      setHeld([])
    }
  }, [recording, onChange])

  const state = recording ? 'recording' : conflict ? 'conflict' : has ? 'recorded' : 'empty'
  const showClear = Boolean(onClear && has && !recording)

  return (
    <div className={cn('k-recwrap relative flex flex-col gap-2 min-w-0', className)}>
      <div className="relative">
        <button
          type="button"
          className={cn(
            'k-rec dc-field flex items-center gap-2.5 w-full min-h-[46px] pl-4 py-2 rounded-xl text-[14.5px] text-left transition-[background-color,border-color] duration-150 cursor-pointer focus-visible:outline-none disabled:opacity-45 disabled:cursor-not-allowed',
            showClear ? 'pr-11' : 'pr-4',
            recording
              ? 'k-rec--recording border-active-border bg-[var(--k-input-hover)] hover:border-active-border'
              : conflict
                ? 'k-rec--conflict border-destructive/70 hover:border-destructive'
                : 'focus-visible:border-active-border'
          )}
          data-state={state}
          disabled={disabled}
          aria-label={`${aria['aria-label']}${has ? ': ' + value!.map(keyLabel).join(' ') : ''}`}
          aria-invalid={!!conflict}
          onClick={() => setRecording((r) => !r)}
          onBlur={() => setRecording(false)}
        >
          {recording ? (
            <>
              <span className="k-rec__dot shrink-0 w-2.5 h-2.5 rounded-full bg-destructive" />
              {held.length ? <KeyCombo keys={held} /> : <span className="text-foreground">Press keys…</span>}
            </>
          ) : has ? (
            <span className="k-rec__keys flex-1 min-w-0 flex items-center overflow-hidden">
              <KeyCombo keys={value!} />
            </span>
          ) : (
            <>
              <Icon name="keyboard" size={18} className="k-rec__icon shrink-0 text-muted-foreground" />
              <span className="k-rec__ph flex-1 text-subtle-foreground truncate">{placeholder}</span>
            </>
          )}
        </button>
        {showClear && (
          <IconButton
            icon="x"
            label="Clear shortcut"
            iconSize={16}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
            onClick={onClear}
          />
        )}
      </div>
      {conflict && !recording && <span className="k-recwrap__msg text-[13px] text-destructive">{conflict}</span>}
    </div>
  )
}
