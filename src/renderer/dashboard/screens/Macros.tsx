import { useEffect, useRef, useState } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { keyLabel } from '@shared/keys'
import type { Macro, MacroStep, Settings } from '@shared/types'
import { MAX_MACRO_STEPS } from '@shared/types'
import { api, useSettings, useStatus } from '../data'
import { cn } from '../lib/utils'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  IconPicker,
  ListGroup,
  ListRow,
  PageHeader,
  ShortcutRecorder,
  Slider,
  TextInput,
  UiBadge,
  useFadeRemove
} from '../ui'
import { newId, plural, removeRefs, usages } from './helpers'
import { queryParam } from './parts'
import type { ScreenProps } from './types'

type StepType = MacroStep['type']
const STEP_META: Record<StepType, { icon: string; label: string; chip: string }> = {
  keys: { icon: 'keyboard', label: 'Press', chip: 'Press shortcut' },
  text: { icon: 'type-text', label: 'Type', chip: 'Type text' },
  open: { icon: 'open', label: 'Open', chip: 'Open app or file' },
  wait: { icon: 'wait', label: 'Wait', chip: 'Wait' }
}
const CHIPS: StepType[] = ['keys', 'text', 'open', 'wait']
const seconds = (ms: number): string => `${Number((ms / 1000).toFixed(2))} s`

const blank = (t: StepType): MacroStep =>
  t === 'keys' ? { type: 'keys', keys: [] } : t === 'text' ? { type: 'text', text: '' } : t === 'open' ? { type: 'open', target: '' } : { type: 'wait', ms: 500 }

/** The text shown in a step row, or null while the step is not filled in yet. */
function describe(s: MacroStep): string | null {
  if (s.type === 'keys') return s.keys.length ? s.keys.map(keyLabel).join(' + ') : null
  if (s.type === 'text') return s.text ? `"${s.text}"` : null
  if (s.type === 'open') return s.target || null
  return seconds(s.ms)
}

/** Macros: list on the left, editor on the right. Steps can be added, edited, reordered (grip: drag or arrow keys) and deleted. */
export function Macros({ toast }: ScreenProps): React.JSX.Element | null {
  const { settings, update } = useSettings()
  const status = useStatus()
  const [selId, setSelId] = useState<string | null>(() => queryParam('macro'))
  if (!settings) return null

  const macro = settings.macros.find((m) => m.id === selId) ?? settings.macros[0] ?? null
  const running = status?.macroRunning ?? null

  const create = (): void => {
    const base = 'New macro'
    let name = base
    for (let n = 2; settings.macros.some((m) => m.name === name); n++) name = `${base} ${n}`
    const id = newId('macro')
    void update((s) => {
      s.macros.push({ id, name, icon: 'macros', steps: [] })
    })
    setSelId(id)
  }
  const newButton = <Button variant="primary" icon="plus" onClick={create}>New macro</Button>

  return (
    <>
      <PageHeader title="Macros" description="Run a list of steps from the dial." side={macro && newButton} />
      {!macro ? (
        <EmptyState icon="macros" title="No macros yet" description="Macros can press shortcuts, type text, open apps or files, and wait.">
          {newButton}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-[288px_minmax(0,1fr)] gap-6 flex-1 min-h-0 items-stretch">
          <Card className="k-side-theme !bg-[#111111] !border-[#1f1f1f] p-3 min-h-0 overflow-y-auto">
            <ListGroup className="gap-1.5">
              {settings.macros.map((m) => (
                <ListRow
                  key={m.id}
                  icon={m.icon}
                  title={m.name}
                  subtitle={m.steps.length ? plural(m.steps.length, 'step') : 'No steps'}
                  trailing={running === m.id ? <Badge type="running" /> : 'chevron'}
                  selected={m.id === macro.id}
                  onClick={() => setSelId(m.id)}
                />
              ))}
            </ListGroup>
          </Card>
          <MacroEditor
            key={macro.id}
            macro={macro}
            settings={settings}
            running={running}
            toast={toast}
            onCommit={(next) =>
              void update((s) => {
                const t = s.macros.find((x) => x.id === next.id)
                if (t) Object.assign(t, next)
              })
            }
            onDelete={() => {
              void update((s) => {
                s.macros = s.macros.filter((x) => x.id !== macro.id)
                removeRefs(s, { macroId: macro.id })
              })
              setSelId(null)
              toast('Macro deleted')
            }}
          />
        </div>
      )}
    </>
  )
}

interface Row {
  k: number
  step: MacroStep
}
interface Draft {
  name: string
  icon: string
  rows: Row[]
}

function MacroEditor({ macro, settings, running, toast, onCommit, onDelete }: {
  macro: Macro
  settings: Settings
  running: string | null
  toast: ScreenProps['toast']
  onCommit: (m: Macro) => void
  onDelete: () => void
}): React.JSX.Element {
  const counter = useRef(0)
  const [draft, setDraft] = useState<Draft>(() => ({
    name: macro.name,
    icon: macro.icon,
    rows: macro.steps.map((step) => ({ k: counter.current++, step: structuredClone(step) }))
  }))
  const [dragging, setDragging] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleted = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const { leaving, remove } = useFadeRemove<number>()

  const next: Macro = { id: macro.id, name: draft.name.trim() || 'Untitled macro', icon: draft.icon, steps: draft.rows.map((r) => r.step) }
  const dirty = JSON.stringify(next) !== JSON.stringify(macro)
  const incomplete = draft.rows.filter((r) => describe(r.step) === null).length
  const valid = incomplete === 0

  // Leaving this macro (another one picked, other screen) keeps finished edits unless deleted.
  const live = useRef({ dirty, valid, next, onCommit })
  live.current = { dirty, valid, next, onCommit }
  useEffect(() => () => {
    const l = live.current
    if (!deleted.current && l.dirty && l.valid) l.onCommit(l.next)
  }, [])

  const setRows = (fn: (rows: Row[]) => Row[]): void => setDraft((d) => ({ ...d, rows: fn(d.rows) }))
  const setStep = (k: number, step: MacroStep): void => setRows((rows) => rows.map((r) => (r.k === k ? { ...r, step } : r)))
  const full = draft.rows.length >= MAX_MACRO_STEPS
  const add = (t: StepType): void => {
    if (full) return
    const k = counter.current++
    setRows((rows) => [...rows, { k, step: blank(t) }])
  }
  const moveTo = (k: number, to: number): void =>
    setRows((rows) => {
      const from = rows.findIndex((r) => r.k === k)
      if (from < 0 || to < 0 || to >= rows.length || from === to) return rows
      const copy = [...rows]
      copy.splice(to, 0, copy.splice(from, 1)[0])
      return copy
    })
  const nudge = (k: number, d: -1 | 1): void => {
    moveTo(k, draft.rows.findIndex((r) => r.k === k) + d)
    // the moved row keeps focus on its grip
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-k="${k}"] .k-step__grip`)?.focus())
  }

  const save = (): void => {
    onCommit(next)
    toast('Saved')
  }
  const run = async (): Promise<void> => {
    if (dirty && valid) onCommit(next)
    try {
      await api.runMacro(macro.id)
    } catch {
      toast('Could not run the macro', 'warning')
    }
  }
  const isRunning = running === macro.id
  const where = usages(settings, { macroId: macro.id })

  return (
    <Card className="k-side-theme !bg-[#111111] !border-[#1f1f1f] min-h-0 h-full flex flex-col !p-8 !gap-0 overflow-hidden">
      <header className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.06] shrink-0">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-foreground truncate">{draft.name.trim() || 'Untitled macro'}</h2>
        <div className="flex items-center gap-2.5 shrink-0">
          {dirty && <UiBadge>Unsaved</UiBadge>}
          <span className="text-[12.5px] font-normal text-muted-foreground tabular-nums">{plural(draft.rows.length, 'step')}</span>
        </div>
      </header>

      <div ref={root} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6 py-6 pr-1">
        <div className="flex items-end gap-4 min-w-0">
          <TextInput className="flex-1 min-w-0" label="Name" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} maxLength={32} />
          <IconPicker value={draft.icon} onChange={(icon) => setDraft((d) => ({ ...d, icon }))} />
        </div>

        <div className="flex flex-col gap-3.5 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Steps</span>
            <span className="text-[12px] font-normal text-subtle-foreground tabular-nums">{draft.rows.length} / {MAX_MACRO_STEPS}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {draft.rows.length === 0 && (
              <div className="min-h-[136px] rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
                <span className="text-[14px] font-medium text-muted-foreground">No steps yet</span>
                <span className="text-[13px] font-normal text-subtle-foreground">Add a shortcut, text, file, or delay below.</span>
              </div>
            )}
            {draft.rows.map((r, i) => {
              const meta = STEP_META[r.step.type]
              const text = describe(r.step)
              return (
                <div
                  key={r.k}
                  data-k={r.k}
                  className={leaving === r.k ? 'k-row-leave' : 'k-row-enter'}
                  onDragOver={(e) => {
                    if (dragging === null) return
                    e.preventDefault()
                    if (dragging !== r.k) moveTo(dragging, i)
                  }}
                >
                  <div
                    role="group"
                    aria-label={`${meta.label} step ${i + 1}${text ? ': ' + text : ', not set'}`}
                    className={cn(
                      'group/step k-step flex flex-col gap-2 p-3 border rounded-2xl text-muted-foreground transition-[background-color,box-shadow,border-color] duration-150 [--k-input:#0e0e0e] [--k-input-hover:#121212] [--k-field-border:#262626]',
                      dragging === r.k ? 'k-step--dragging bg-[#1a1a1a] border-active-border shadow-xl' : 'bg-[#161616] border-[#222222] hover:border-[#2c2c2c] focus-within:border-[#2c2c2c]'
                    )}
                  >
                    <div
                      className="flex items-center gap-3 min-h-9 select-none"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        setDragging(r.k)
                      }}
                      onDragEnd={() => setDragging(null)}
                    >
                      <span
                        className="k-step__grip cursor-grab flex text-subtle-foreground/70 hover:text-foreground rounded-lg focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-1"
                        tabIndex={0}
                        role="button"
                        aria-label={`Move step ${i + 1}: press arrow up or down`}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault()
                            e.stopPropagation()
                            nudge(r.k, e.key === 'ArrowUp' ? -1 : 1)
                          }
                        }}
                      >
                        <Icon name="grip" size={20} />
                      </span>
                      <span className="flex items-center gap-2 w-[78px] shrink-0 text-muted-foreground">
                        <Icon name={meta.icon} size={17} className="shrink-0" />
                        <span className="k-step__type text-[13px]">{meta.label}</span>
                      </span>
                      <span className="k-step__body flex-1 min-w-0 flex items-center gap-2">
                        <span className="k-step__value text-[14.5px] font-medium text-foreground truncate">
                          {text ?? <span className="text-warning font-normal">Not set</span>}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <IconButton icon="chevron-down" className="h-8 w-8 [&_svg]:rotate-180" label="Move step up" iconSize={16} disabled={i === 0} onClick={() => nudge(r.k, -1)} />
                        <IconButton icon="chevron-down" className="h-8 w-8" label="Move step down" iconSize={16} disabled={i === draft.rows.length - 1} onClick={() => nudge(r.k, 1)} />
                        <IconButton
                          icon="trash"
                          className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                          label="Delete step"
                          iconSize={17}
                          onClick={() => remove(r.k, () => setRows((rows) => rows.filter((x) => x.k !== r.k)))}
                        />
                      </span>
                    </div>
                    <div className="pl-8">
                      <StepEditor step={r.step} onChange={(s) => setStep(r.k, s)} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3.5 min-w-0">
          <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Add step</span>
          <div className="flex flex-wrap gap-2.5">
            {CHIPS.map((t) => (
              <button
                key={t}
                type="button"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.14] text-muted-foreground hover:text-foreground text-[13.5px] font-medium transition-[background-color,border-color,color] cursor-pointer focus-visible:outline-none focus-visible:border-active-border disabled:opacity-45 disabled:pointer-events-none"
                disabled={full}
                onClick={() => add(t)}
              >
                <Icon name={STEP_META[t].icon} size={15} />
                {STEP_META[t].chip}
              </button>
            ))}
          </div>
          <p className={cn('m-0 text-[13px] font-normal', incomplete || full ? 'text-warning' : 'text-subtle-foreground')}>
            {incomplete
              ? `Fill in ${plural(incomplete, 'step')} marked "Not set" to save.`
              : full
                ? `A macro holds up to ${MAX_MACRO_STEPS} steps.`
                : `Up to ${MAX_MACRO_STEPS} steps. Press the knob to stop a running macro.`}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5 border-t border-white/[0.06] flex items-center gap-3 shrink-0">
        <Button variant="primary" className="disabled:opacity-60" disabled={!dirty || !valid} onClick={save}>Save</Button>
        {isRunning ? (
          <Button variant="danger" icon="x" onClick={() => void api.stopMacro()}>Stop</Button>
        ) : (
          <Button variant="secondary" icon="play" disabled={draft.rows.length === 0 || !valid || (running !== null && !isRunning)} onClick={() => void run()}>Run now</Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" icon="trash" className="text-muted-foreground hover:text-destructive hover:bg-destructive/12" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${macro.name}?`}
        description={where.length > 0 ? `It is used in ${where.join(', ')}; those places will be emptied.` : 'It is not used on the dial.'}
        confirmLabel="Delete"
        onConfirm={() => {
          deleted.current = true
          setConfirmDelete(false)
          onDelete()
        }}
      />
    </Card>
  )
}

function StepEditor({ step, onChange }: { step: MacroStep; onChange: (s: MacroStep) => void }): React.JSX.Element {
  const compact = 'min-w-0 [&_.k-field__input]:!h-10 [&_.k-field__input]:!text-[14px]'
  if (step.type === 'keys') {
    return <ShortcutRecorder className="min-w-0 [&_.k-rec]:!min-h-10 [&_.k-rec]:!py-1.5 [&_.k-rec]:!text-[14px]" aria-label="Shortcut to press" value={step.keys} onChange={(keys) => onChange({ type: 'keys', keys })} />
  }
  if (step.type === 'text') {
    return <TextInput className={compact} aria-label="Text to type" value={step.text} maxLength={500} placeholder="Text typed into the focused app" onChange={(text) => onChange({ type: 'text', text })} />
  }
  if (step.type === 'open') {
    return (
      <TextInput
        className={compact}
        aria-label="App, file, folder or website"
        value={step.target}
        placeholder="C:\Projects  or  https://example.com"
        onChange={(target) => onChange({ type: 'open', target })}
      />
    )
  }
  return <Slider className="min-w-0 py-1" aria-label="Wait duration" min={100} max={10000} step={100} value={step.ms} format={seconds} onChange={(ms) => onChange({ type: 'wait', ms })} />
}
