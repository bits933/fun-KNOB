import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import type { PickedApp } from '@shared/api'
import { DEFAULT_APPS } from '@shared/defaults'
import { codeToKey, keyLabel, normalizeKeys } from '@shared/keys'
import type { AppDef, KeyName, Macro, MacroStep, ShortcutSlot } from '@shared/types'
import { MAX_MACRO_STEPS } from '@shared/types'
import { api } from '../data'
import { cn } from '../lib/utils'
import { Button, ConfirmDialog, Dropdown, IconButton, IconPicker, KeyCombo, Separator, ShortcutRecorder, SidePanel, TextInput } from '../ui'
import { mergeAppChoices } from './appChoices'
import type { AppChoice } from './appChoices'
import { appSlot, newId, strokeConflict, strokeKeys, wheelText } from './helpers'

/** Label above a control inside a side panel or editor. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={className ? `pf ${className}` : 'pf'}>
      <span className="k-label">{label}</span>
      {children}
    </div>
  )
}

/** Value of a `?name=` query parameter, used only to pick the first state for screenshots. */
export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

const NEW_SLOT = (): ShortcutSlot => ({ name: '', icon: 'step', left: null, right: null, click: null })
const isDefault = (id: string): boolean => DEFAULT_APPS.some((a) => a.id === id)

export function AppSlotPanel({ app, index, onClose, onSave, onClear, onReset, pinned }: {
  pinned?: boolean
  app: AppDef
  index: number
  onClose: () => void
  onSave: (s: ShortcutSlot) => void
  onClear: () => void
  onReset?: () => void
}): React.JSX.Element {
  const existing = app.slots[index]
  const [draft, setDraft] = useState<ShortcutSlot>(() => existing ?? NEW_SLOT())
  const [shown, setShown] = useState(`${app.id}:${index}`)
  const [resetting, setResetting] = useState(false)
  if (shown !== `${app.id}:${index}`) {
    // another slot picked while the panel stays open
    setShown(`${app.id}:${index}`)
    setDraft(app.slots[index] ?? NEW_SLOT())
    setResetting(false)
  }
  const set = (patch: Partial<ShortcutSlot>): void => setDraft((d) => ({ ...d, ...patch }))
  const leftKeys = strokeKeys(draft.left)
  const rightKeys = strokeKeys(draft.right)
  const valid = draft.name.trim() !== '' && (draft.left !== null || draft.right !== null)
  const resetLabel = isDefault(app.id) ? `Reset ${app.name} to defaults` : 'Clear all slots'

  return (
    <SidePanel
      title={existing ? `Edit · ${existing.name}` : `New function · slot ${index + 1}`}
      onClose={onClose}
      pinned={pinned}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>Save</Button>
        </>
      }
    >
      <div className="pf__row">
        <TextInput className="pf__grow" label="Name" value={draft.name} onChange={(name) => set({ name })} maxLength={28} placeholder="e.g. Brush size" />
        <IconPicker value={draft.icon} onChange={(icon) => set({ icon })} />
      </div>
      <Field label="Turn left">
        <ShortcutRecorder
          aria-label="Turn left shortcut"
          value={leftKeys}
          placeholder={wheelText(draft.left) ?? undefined}
          conflict={strokeConflict(app, index, leftKeys)}
          onChange={(keys) => set({ left: { type: 'keys', keys } })}
          onClear={() => set({ left: null })}
        />
      </Field>
      <Field label="Turn right">
        <ShortcutRecorder
          aria-label="Turn right shortcut"
          value={rightKeys}
          placeholder={wheelText(draft.right) ?? undefined}
          conflict={strokeConflict(app, index, rightKeys)}
          onChange={(keys) => set({ right: { type: 'keys', keys } })}
          onClear={() => set({ right: null })}
        />
      </Field>
      <Field label="Click (optional)">
        <ShortcutRecorder
          aria-label="Click shortcut"
          value={strokeKeys(draft.click)}
          onChange={(keys) => set({ click: { type: 'keys', keys } })}
          onClear={() => set({ click: null })}
        />
      </Field>
      {(existing || onReset) && <Separator className="my-1" />}
      {(existing || onReset) && (
        <div className="flex flex-col items-start gap-2">
          {existing && (
            <Button variant="ghost" size="sm" icon="trash" className="-ml-2 text-muted-foreground hover:text-foreground" onClick={onClear}>
              Clear slot
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" className="-ml-2 text-destructive/90 hover:text-destructive hover:bg-destructive/12" onClick={() => setResetting(true)}>
              {resetLabel}
            </Button>
          )}
        </div>
      )}
      {onReset && (
        <ConfirmDialog
          open={resetting}
          onOpenChange={setResetting}
          title={resetLabel}
          description={isDefault(app.id) ? `Restore all ${app.name} slots to the factory shortcuts?` : `Empty all ${app.name} slots?`}
          confirmLabel={isDefault(app.id) ? 'Reset' : 'Clear'}
          onConfirm={() => {
            setResetting(false)
            onReset()
          }}
        />
      )}
    </SidePanel>
  )
}

export function AppChooser({ apps, value, onChoose }: {
  apps: AppDef[]
  value: string
  onChoose: (app: AppChoice) => void
}): React.JSX.Element {
  const [installed, setInstalled] = useState<PickedApp[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void api.listInstalledApps().then((a) => { if (live) setInstalled(a) }).catch(() => { if (live) setError('Could not detect apps. You can still add a custom path.') })
    return () => { live = false }
  }, [])
  const choices = mergeAppChoices(apps, installed)
  return (
    <Field label="Choose an app detected on this PC">
      <Dropdown
        aria-label="App"
        size="lg"
        value={value}
        placeholder="Choose an app"
        searchable
        searchPlaceholder="Search apps"
        options={choices.map((a, i) => ({ value: a.id ?? `installed-${i}`, label: a.name, lead: <SlotIcon slot={appSlot(a)} size={26} /> }))}
        onChange={(id) => {
          const a = choices.find((x, i) => (x.id ?? `installed-${i}`) === id)
          if (a) onChoose(a)
        }}
      />
      <button
        type="button"
        onClick={() => {
          void api.pickApp().then((a) => { if (a) onChoose(a) }).catch(() => setError('Could not open the app picker. Try again.'))
        }}
        className="group mt-1.5 w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border-[1.5px] border-dashed border-border-strong bg-input text-left transition-[background-color,border-color] duration-150 hover:border-active-border hover:bg-[var(--k-input-hover)] focus-visible:outline-none focus-visible:border-active-border cursor-pointer"
      >
        <span className="flex items-center justify-center shrink-0 w-10 h-10 rounded-xl bg-secondary border border-border text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
          <Icon name="folder" size={20} />
        </span>
        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span className="text-[14px] font-medium text-foreground leading-snug">Add custom path</span>
          <span className="text-[12.5px] text-muted-foreground leading-snug">Browse in Explorer for an .exe file</span>
        </span>
      </button>
      {error && <p className="pf__note text-destructive" role="alert">{error}</p>}
    </Field>
  )
}

const MACRO_MODS = ['Ctrl', 'Shift', 'Alt', 'Win']

function heldMacroMods(e: KeyboardEvent): KeyName[] {
  const m: KeyName[] = []
  if (e.ctrlKey) m.push('Ctrl')
  if (e.shiftKey) m.push('Shift')
  if (e.altKey) m.push('Alt')
  if (e.metaKey) m.push('Win')
  return m
}

function macroStepBadge(step: MacroStep): ReactNode {
  if (step.type === 'keys') return <KeyCombo keys={step.keys} />
  if (step.type === 'text') {
    return (
      <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[12.5px] text-foreground truncate max-w-[160px]">
        &ldquo;{step.text}&rdquo;
      </span>
    )
  }
  if (step.type === 'open') {
    return (
      <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[12.5px] text-foreground truncate max-w-[160px]">
        <Icon name="open" size={13} />
        {step.target}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.07] font-mono text-[12px] text-muted-foreground">
      {Number((step.ms / 1000).toFixed(2))}s
    </span>
  )
}

function autoMacroName(steps: MacroStep[], existing: Macro[]): string {
  const first = steps.find((s): s is Extract<MacroStep, { type: 'keys' }> => s.type === 'keys' && s.keys.length > 0)
  if (first) return first.keys.map(keyLabel).join(' + ')
  let n = existing.length + 1
  let name = `Macro ${n}`
  while (existing.some((m) => m.name === name)) name = `Macro ${++n}`
  return name
}

/**
 * Inline macro selector + visible macro steps field + dotted click-to-record area.
 * Lets users inspect existing macros, record key sequences right in the slot panel, or jump to the full Macros screen.
 */
export function MacroChooser({
  macros,
  value,
  onSelect,
  onUpsert,
  goMacros
}: {
  macros: Macro[]
  value: string
  onSelect: (macroId: string) => void
  onUpsert: (macro: Macro) => void
  goMacros: () => void
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [held, setHeld] = useState<KeyName[]>([])
  const current = macros.find((m) => m.id === value) ?? null
  const steps = current?.steps ?? []
  const full = steps.length >= MAX_MACRO_STEPS

  useEffect(() => {
    if (!recording) return
    const down = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      const mods = heldMacroMods(e)
      if (e.code === 'Escape' && mods.length === 0) {
        setRecording(false)
        return
      }
      const key = codeToKey(e.code)
      if (!key) return
      if (MACRO_MODS.includes(key)) {
        setHeld(mods)
        return
      }
      const combo = normalizeKeys([...mods, key])
      const nextStep: MacroStep = { type: 'keys', keys: combo }
      if (current) {
        if (current.steps.length >= MAX_MACRO_STEPS) {
          setRecording(false)
          return
        }
        const nextSteps = [...current.steps, nextStep]
        const renamed = current.name === 'New macro' && current.steps.length === 0 ? autoMacroName(nextSteps, macros) : current.name
        onUpsert({ ...current, name: renamed, steps: nextSteps })
      } else {
        const id = newId('macro')
        const nextSteps = [nextStep]
        onUpsert({ id, name: autoMacroName(nextSteps, macros), icon: 'macros', steps: nextSteps })
        onSelect(id)
      }
    }
    const up = (e: KeyboardEvent): void => {
      e.preventDefault()
      setHeld(heldMacroMods(e))
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      setHeld([])
    }
  }, [recording, current, macros, onUpsert, onSelect])

  const clearSteps = (): void => {
    if (!current) return
    onUpsert({ ...current, steps: [] })
  }

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {macros.length > 0 && (
        <Field label="Saved macro">
          <Dropdown
            aria-label="Macro"
            value={value}
            placeholder="Choose a macro"
            options={macros.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(id) => {
              setRecording(false)
              onSelect(id)
            }}
          />
        </Field>
      )}

      {current && (
        <TextInput
          label="Macro name"
          value={current.name}
          maxLength={32}
          placeholder="e.g. Export for web"
          onChange={(name) => onUpsert({ ...current, name })}
        />
      )}

      <Field label="Macro sequence">
        <div
          className={cn(
            'dc-field relative flex items-center gap-2 min-h-[48px] pl-4 py-2.5 rounded-xl text-[14px] transition-colors duration-150',
            steps.length > 0 && !recording ? 'pr-11' : 'pr-4',
            recording && 'border-active-border bg-[var(--k-input-hover)]'
          )}
          data-macro-preview="true"
        >
          {steps.length > 0 || (recording && held.length > 0) ? (
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {steps.map((step, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="text-[12px] text-subtle-foreground px-0.5">→</span>}
                  {macroStepBadge(step)}
                </Fragment>
              ))}
              {recording && held.length > 0 && (
                <>
                  {steps.length > 0 && <span className="text-[12px] text-subtle-foreground px-0.5">→</span>}
                  <KeyCombo keys={held} />
                </>
              )}
            </div>
          ) : (
            <span className="text-[14px] text-subtle-foreground truncate">
              {recording ? 'Press keys to add steps…' : 'Recorded keys will appear here'}
            </span>
          )}
          {steps.length > 0 && !recording && (
            <IconButton
              icon="x"
              label="Clear macro steps"
              iconSize={16}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
              onClick={clearSteps}
            />
          )}
        </div>
      </Field>

      <button
        type="button"
        data-recording={recording ? 'true' : undefined}
        disabled={full && !recording}
        onClick={() => setRecording((r) => !r)}
        className={cn(
          'group w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border-[1.5px] border-dashed text-left transition-[background-color,border-color] duration-150 focus-visible:outline-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
          recording
            ? 'border-active-border bg-[var(--k-input-hover)]'
            : 'border-border-strong bg-input hover:border-active-border hover:bg-[var(--k-input-hover)] focus-visible:border-active-border'
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center shrink-0 w-10 h-10 rounded-xl border transition-colors duration-150',
            recording
              ? 'bg-destructive/18 border-destructive/40 text-destructive'
              : 'bg-secondary border-border text-muted-foreground group-hover:text-foreground'
          )}
        >
          {recording ? <span className="k-rec__dot w-3 h-3 rounded-full bg-destructive" /> : <Icon name="macros" size={20} />}
        </span>
        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span className="text-[14px] font-medium text-foreground leading-snug">
            {recording ? 'Recording macro… click to stop' : 'Click to record macro'}
          </span>
          <span className="text-[12.5px] text-muted-foreground leading-snug">
            {recording
              ? 'Press key combos in order, or Esc to finish'
              : full
                ? `Maximum of ${MAX_MACRO_STEPS} steps reached`
                : 'Press shortcuts to capture steps automatically'}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="pf__note">Click runs the macro.</p>
        <Button variant="ghost" size="sm" className="-mr-2 text-accent-foreground hover:bg-primary/14" onClick={goMacros}>
          Full editor
        </Button>
      </div>
    </div>
  )
}
