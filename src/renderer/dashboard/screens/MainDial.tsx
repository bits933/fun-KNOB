import { useEffect, useState } from 'react'
import { SYSTEM_META, SYSTEM_STEP, SYSTEM_TURN } from '@shared/defaults'
import type { AppDef, CustomSlot, FolderItem, Macro, Settings, SystemControl, SystemSlot } from '@shared/types'
import { MAX_SLOTS, MIN_SLOTS } from '@shared/types'
import { useSettings } from '../data'
import { useHistory } from '../data/hooks'
import { Button, IconButton, Dropdown, IconPicker, PageHeader, SegmentedControl, SidePanel, Slider, Switch, TextInput } from '../ui'
import type { Option } from '../ui'
import { STEP_RANGE, appSlot, mainDialView, appDialView, folderDialView, padItems, slotKindText, validDialPath, newId, resetMainDial } from './helpers'
import { AppChooser, AppSlotPanel, Field, MacroChooser, queryParam } from './parts'
import { DialWheel, moveItem } from './DialWheel'
import type { DialPath } from './helpers'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import { sameApp, saveSlotApps } from './appChoices'
import type { AppChoice } from './appChoices'
import type { ScreenProps } from './types'

const CONTROL_OPTIONS: Option<SystemControl>[] = (Object.keys(SYSTEM_META) as SystemControl[]).map((c) => ({ value: c, label: SYSTEM_META[c].name, lead: <Icon name={SYSTEM_META[c].icon} size={18} />, accent: c === 'dj' }))
type CustomType = CustomSlot['type'] | 'system'
const TYPE_OPTIONS: Option<CustomType>[] = [
  { value: 'system', label: 'System' },
  { value: 'app', label: 'App' },
  { value: 'macro', label: 'Macro' },
  { value: 'folder', label: 'Folder' }
]
const EMPTY_FOLDER = (): CustomSlot => ({ type: 'folder', name: 'Folder', icon: 'folder', items: padItems([]) })

type Draft = { kind: 'system'; slot: SystemSlot } | { kind: 'custom'; slot: CustomSlot }

function draftFor(s: Settings, i: number): Draft {
  const slot = s.mainDial.slots[i]
  const forced = queryParam('type')
  if (forced === 'app') return { kind: 'custom', slot: { type: 'app', appId: s.apps[0]?.id ?? '' } }
  if (forced === 'macro') return { kind: 'custom', slot: { type: 'macro', macroId: s.macros[0]?.id ?? '' } }
  return slot.type === 'system' ? { kind: 'system', slot: { ...slot } } : { kind: 'custom', slot: structuredClone(slot) }
}

/** Nested editor path refers to the original main slot and folder place. */
export function MainDial({ navigate, toast }: ScreenProps): React.JSX.Element | null {
  const { settings, update } = useSettings()
  const { canUndo, canRedo, undo, redo } = useHistory()
  const [path, setPath] = useState<DialPath>(() => ({
    custom: queryParam('folder') ? Number(queryParam('folder')) - 1 : null,
    appId: queryParam('app'),
    place: queryParam('app') && queryParam('folder') ? Number(queryParam('place') ?? '3') - 1 : null
  }))
  const [sel, setSel] = useState<number | null>(() => {
    const raw = queryParam('slot')
    if (raw === 'none') return null
    const n = Number(raw)
    if (n >= 1 && n <= MAX_SLOTS) return n - 1
    return !queryParam('folder') && !queryParam('app') ? 0 : null
  })
  const [backward, setBackward] = useState(false)
  // The side panel is pinned: Cancel / Save / Clear re-read the slot in place (new key) instead of closing it.
  const [nonce, setNonce] = useState(0)
  const reload = (): void => setNonce(n => n + 1)
  const go = (next: DialPath, back = false): void => { setBackward(back); setPath(next); setSel(null) }
  const back = (): void => {
    if (path.appId && path.custom !== null) go({ ...path, appId: null, place: null }, true)
    else go({ custom: null, appId: null, place: null }, true)
  }
  useEffect(() => {
    if (settings && !validDialPath(settings, path)) go({ custom: null, appId: null, place: null }, true)
  }, [settings, path])
  /** The selected slot may not exist after a history step. */
  const step = (fn: () => void): void => { fn(); setSel(null) }
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target?.closest('input, textarea, [contenteditable="true"], .k-rec')
      if (e.defaultPrevented || (typing && (e.key === 'Backspace' || e.ctrlKey || e.metaKey))) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'y')) {
        e.preventDefault()
        if (k === 'z' && !e.shiftKey) { if (canUndo) step(undo) } else if (canRedo) step(redo)
        return
      }
      if ((e.key === 'Escape' || e.key === 'Backspace') && sel === null && (path.appId || path.custom !== null)) {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canUndo, canRedo, path, sel])
  if (!settings) return null
  const custom = path.custom === null ? null : settings.mainDial.slots[path.custom]
  const folder = custom?.type === 'folder' ? custom : null
  const app = path.appId ? settings.apps.find(a => a.id === path.appId) : null
  const level = app ? 'app' : folder ? 'folder' : 'main'
  const view = app ? appDialView(app, 0) : folder ? folderDialView(settings, folder) : mainDialView(settings, 0)
  view.slots = view.slots.map(s => s.kind === 'empty' ? { ...s, name: '+ Add', icon: 'plus' } : s)
  const open = (i: number): void => {
    if (app) return
    const c = folder ? folder.items[i] : settings.mainDial.slots[i]
    if (!c) return
    if (c.type === 'folder') go({ custom: i, appId: null, place: null })
    else if (c.type === 'app' && settings.apps.some(a => a.id === c.appId)) go({ custom: folder ? path.custom : null, appId: c.appId, place: i })
  }
  const choose = (i: number): void => {
    if (level === 'main' && sel === i && view.slots[i].kind === 'folder') open(i)
    else setSel(i)
  }
  const move = (from: number, to: number): void => {
    if (from === to || to < 0 || to >= view.slots.length) return
    void update(s => {
      if (app) { const a = s.apps.find(a => a.id === app.id); if (a) a.slots = moveItem(a.slots, from, to) }
      else if (folder && path.custom !== null) { const f = s.mainDial.slots[path.custom]; if (f.type === 'folder') f.items = moveItem(f.items, from, to) }
      else s.mainDial.slots = moveItem(s.mainDial.slots, from, to)
    })
    // the selection follows the item it was on
    setSel(i => i === null ? null : moveItem([...view.slots.keys()], from, to).indexOf(i))
    toast('Saved')
  }
  const remove = (i: number): void => {
    if (view.slots.length <= MIN_SLOTS) return
    void update(s => {
      if (app) { const a = s.apps.find(a => a.id === app.id); if (a) a.slots.splice(i, 1) }
      else if (folder && path.custom !== null) { const f = s.mainDial.slots[path.custom]; if (f.type === 'folder') f.items.splice(i, 1) }
      else s.mainDial.slots.splice(i, 1)
    })
    setSel(null)
    toast('Removed')
  }
  return <div className="split">
    <div className="split__pane"><div className="split__main">
      <PageHeader title="Main dial" description="Select a slot to edit." side={
        <div className="mdial__tools" role="toolbar" aria-label="History">
          <IconButton icon="undo" label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => step(undo)} />
          <IconButton icon="redo" label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => step(redo)} />
          <span className="mdial__toolsep" aria-hidden="true" />
          <IconButton icon="reset" label="Reset" title="Reset Main dial" onClick={() => { void update(s => resetMainDial(s)); setSel(null); toast('Main dial reset', 'reset') }} />
        </div>} />
      {/* Only shown inside a folder or app dial; the row keeps its height so the wheel never jumps. */}
      <nav className="mdial__crumbs" aria-label="Dial path" data-root={level === 'main'} aria-hidden={level === 'main'}>
        <button type="button" onClick={() => go({ custom: null, appId: null, place: null }, true)}>Main dial</button>
        {folder && <><Icon name="chevron-right" size={14} className="text-subtle-foreground" /><button type="button" aria-current={app ? undefined : 'page'} onClick={() => go({ ...path, appId: null, place: null }, true)}>{folder.name}</button></>}
        {app && <><Icon name="chevron-right" size={14} className="text-subtle-foreground" /><button type="button" aria-current="page" onClick={() => setSel(null)}>{app.name}</button></>}
      </nav>
      <DialWheel view={view} selected={sel} onSelect={choose} onOpen={open} onMove={move} onRemove={remove} onAdd={() => { if (view.slots.length >= MAX_SLOTS) return; void update(s => { if (app) s.apps.find(a => a.id === app.id)?.slots.push(null); else if (folder && path.custom !== null) { const f = s.mainDial.slots[path.custom]; if (f.type === 'folder') f.items.push(null) } else s.mainDial.slots.push({type:'empty'}) }); setSel(null) }} backward={backward}
        pathKey={`${path.custom}:${path.appId}`} onBack={level === 'main' ? undefined : back}
        kinds={view.slots.map((s, i) => level === 'main' ? (() => {
          const m = settings.mainDial.slots[i]
          return m?.type === 'system' && m.control === settings.general.defaultControl ? 'System · Default' : slotKindText(settings, i)
        })() : app ?
          (app.slots[i] ? [app.slots[i]?.left, app.slots[i]?.right].map(st => st?.type === 'keys' ? st.keys.join('+') : st?.type === 'wheel' ? `Wheel ${st.dir}` : '\u2014').join(' / ') : 'Empty') : s.kind === 'app' ? 'App' : s.kind === 'macro' ? 'Macro' : 'Empty')} />
    </div></div>
    {sel === null ? (
      <SidePanel pinned title="Edit slot" onClose={() => {}}>
        <p className="pf__note">Select a slot on the dial to edit it.</p>
      </SidePanel>
    ) : app ? <AppSlotPanel pinned key={`${app.id}:${sel}:${nonce}`} app={app} index={sel} onClose={reload}
      onSave={next => { void update(s => { const a = s.apps.find(a => a.id === app.id); if (a) a.slots[sel] = next }); toast('Saved'); reload() }}
      onClear={() => { void update(s => { const a = s.apps.find(a => a.id === app.id); if (a) a.slots[sel] = null }); toast('Saved'); reload() }} /> :
      <SlotPanel key={`${level}:${path.custom}:${sel}:${nonce}`} slot={sel} settings={settings} folderPlace={folder ? folder.items[sel] ?? { type: 'empty' } : undefined}
        onClose={reload} goMacros={() => navigate('macros')}
        onSave={(d, pending, pendingMacros, makeDefault) => {
          void update(s => {
            const prevSlot = folder ? undefined : s.mainDial.slots[sel]
            for (const pm of pendingMacros) {
              const cleaned = { ...pm, name: pm.name.trim() || 'Untitled macro' }
              const idx = s.macros.findIndex((m) => m.id === cleaned.id)
              if (idx >= 0) s.macros[idx] = cleaned
              else s.macros.push(cleaned)
            }
            if (d.kind === 'custom') d = { ...d, slot: saveSlotApps(s, d.slot, pending) }
            if (folder && path.custom !== null && d.kind === 'custom') {
              const f = s.mainDial.slots[path.custom]
              if (f.type === 'folder') f.items[sel] = d.slot.type === 'app' || d.slot.type === 'macro' ? d.slot : null
            } else if (d.kind === 'system') s.mainDial.slots[sel] = { type:'system', ...d.slot }
            else {
              s.mainDial.slots[sel] = d.slot
            }
            if (d.kind === 'system') {
              if (makeDefault) s.general.defaultControl = d.slot.control
              else if (s.general.defaultControl === d.slot.control || (prevSlot?.type === 'system' && s.general.defaultControl === prevSlot.control)) s.general.defaultControl = null
            } else if (prevSlot?.type === 'system' && s.general.defaultControl === prevSlot.control) {
              const stillThere = s.mainDial.slots.some((x, idx) => idx !== sel && x.type === 'system' && x.control === prevSlot.control)
              if (!stillThere) s.general.defaultControl = null
            }
          }); toast('Saved'); reload()
        }} />}
  </div>
}

function SlotPanel({ slot, settings, onClose, onSave, goMacros, folderPlace }: {
  folderPlace?: CustomSlot
  slot: number
  settings: Settings
  onClose: () => void
  onSave: (d: Draft, pending: AppDef[], pendingMacros: Macro[], makeDefault: boolean) => void
  goMacros: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => folderPlace ? { kind: 'custom', slot: structuredClone(folderPlace) } : draftFor(settings, slot))
  const [isDefault, setIsDefault] = useState<boolean>(() => draft.kind === 'system' && settings.general.defaultControl === draft.slot.control)
  const [pending, setPending] = useState<AppDef[]>([])
  const [pendingMacros, setPendingMacros] = useState<Macro[]>([])
  const apps = [...settings.apps, ...pending]
  const macros: Macro[] = [
    ...settings.macros.map((m) => pendingMacros.find((p) => p.id === m.id) ?? m),
    ...pendingMacros.filter((p) => !settings.macros.some((m) => m.id === p.id))
  ]
  const chooseApp = (a: AppChoice): string => {
    const existing = apps.find(b => sameApp(a, b))
    if (existing) return existing.id
    const app: AppDef = { ...a, id: newId('app'), icon: 'apps-folder', slots: Array(8).fill(null) }
    setPending(p => [...p, app])
    return app.id
  }
  const upsertMacro = (m: Macro): void => {
    setPendingMacros((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id)
      return idx >= 0 ? prev.map((x, i) => (i === idx ? m : x)) : [...prev, m]
    })
  }

  const c = draft.kind === 'custom' ? draft.slot : null
  const valid = !c || (c.type === 'app' ? apps.some((a) => a.id === c.appId) : c.type === 'macro' ? macros.some((m) => m.id === c.macroId) : true)

  const setCustom = (v: CustomSlot): void => setDraft({ kind: 'custom', slot: v })
  const pickType = (t: CustomType): void => {
    if (t === 'system') { setDraft({ kind: 'system', slot: { control: 'volume', step: SYSTEM_STEP.volume } }); setIsDefault(settings.general.defaultControl === 'volume'); return }
    if (draft.kind === 'custom' && draft.slot.type === t) return
    if (t === 'app') setCustom({ type: 'app', appId: settings.apps[0]?.id ?? '' })
    else if (t === 'macro') setCustom({ type: 'macro', macroId: macros[0]?.id ?? '' })
    else if (t === 'folder') setCustom(EMPTY_FOLDER())
    else setCustom({ type: 'empty' })
  }

  return (
    <SidePanel
      pinned
      title={`Edit slot ${slot + 1}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(draft, pending, pendingMacros, isDefault)}>Save</Button>
        </>
      }
    >
      <Field label="Slot type"><SegmentedControl aria-label="Slot type" value={draft.kind === 'system' ? 'system' : draft.slot.type} options={folderPlace ? TYPE_OPTIONS.filter(o => o.value !== 'folder' && o.value !== 'system') : TYPE_OPTIONS} onChange={pickType} /></Field>
      {/* Keyed by type: the new editor blurs in in place instead of the panel snapping to a new height. */}
      <div key={draft.kind === 'system' ? 'system' : draft.slot.type} className="k-swap flex flex-col gap-[22px]">
      {draft.kind === 'system' ? (
        <SystemEditor
          gestures={settings.gestures}
          value={draft.slot}
          onChange={(v) => { setDraft({ kind: 'system', slot: v }); if (v.control !== draft.slot.control) setIsDefault(settings.general.defaultControl === v.control) }}
          isDefault={isDefault}
          onToggleDefault={setIsDefault}
          defaultReturnSec={Math.round(settings.general.defaultReturnMs / 1000)}
        />
      ) : (
        <>
          {draft.slot.type === 'app' && (
            <AppChooser apps={apps} value={draft.slot.appId} onChoose={a => setCustom({ type: 'app', appId: chooseApp(a) })} />
          )}
          {draft.slot.type === 'macro' && (
            <MacroChooser
              macros={macros}
              value={draft.slot.macroId}
              onSelect={(macroId) => setCustom({ type: 'macro', macroId })}
              onUpsert={upsertMacro}
              goMacros={goMacros}
            />
          )}
          {draft.slot.type === 'folder' && <FolderEditor value={draft.slot} onChange={setCustom} macros={macros} upsertMacro={upsertMacro} apps={apps} chooseApp={chooseApp} goMacros={goMacros} />}
          {draft.slot.type === 'empty' && <p className="pf__note">Choose what this slot does. Until then it shows as dimmed on the dial.</p>}
        </>
      )}
      </div>
    </SidePanel>
  )
}

function SystemEditor({ value, onChange, gestures, isDefault, onToggleDefault, defaultReturnSec }: {
  value: SystemSlot
  onChange: (v: SystemSlot) => void
  gestures: Settings['gestures']
  isDefault: boolean
  onToggleDefault: (v: boolean) => void
  defaultReturnSec: number
}): React.JSX.Element {
  const range = STEP_RANGE[value.control]
  const [left, right] = SYSTEM_TURN[value.control]
  const keys: Array<[string, string]> = [
    ['Turn left', left], ['Turn right', right], ['Click', 'Open main dial'],
    ['Long press', gestures.closedLong === 'mute' ? 'Mute / unmute' : 'Nothing']
  ]
  return (
    <>
      <Field label="Control">
        <Dropdown
          aria-label="Control"
          value={value.control}
          options={CONTROL_OPTIONS}
          onChange={(control) => onChange({ control, step: SYSTEM_STEP[control] })}
        />
      </Field>
      <div key={value.control} className="k-swap flex flex-col gap-[22px]">
      {value.control !== 'dj' && (
        <>
          <Slider
            label="Step size"
            min={range.min}
            max={range.max}
            value={Math.min(range.max, Math.max(range.min, value.step))}
            format={(v) => `${v}${range.unit}`}
            onChange={(step) => onChange({ ...value, step })}
          />
          <p className="pf__note">How much one click of the knob changes.</p>
        </>
      )}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--k-table-bg)] border border-border px-4 py-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-[13.5px] font-medium text-foreground">Default option</span>
          <span className="text-[12.5px] font-normal text-muted-foreground">Return here after {defaultReturnSec} s idle</span>
        </div>
        <Switch label="Default option" checked={isDefault} onChange={onToggleDefault} />
      </div>
      <Field label="Knob">
        <dl className="pf__keys rounded-2xl bg-[var(--k-table-bg)] border border-border divide-y divide-border text-[14px]">
          {keys.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="font-normal text-muted-foreground">{k}</dt>
              <dd className="m-0 font-medium text-foreground text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Field>
      </div>
    </>
  )
}

function FolderEditor({ value, onChange, macros, upsertMacro, apps, chooseApp, goMacros }: {
  macros: Macro[]
  upsertMacro: (m: Macro) => void
  apps: AppDef[]
  chooseApp: (a: AppChoice) => string
  goMacros: () => void
  value: Extract<CustomSlot, { type: 'folder' }>
  onChange: (c: CustomSlot) => void
}): React.JSX.Element {
  const [adding, setAdding] = useState(() => queryParam('add') === '1')
  const [kind, setKind] = useState<'app' | 'macro'>('app')
  const [appId, setAppId] = useState('')
  const [macroId, setMacroId] = useState(macros[0]?.id ?? '')
  const full = value.items.every(Boolean)
  const item: FolderItem | null = kind === 'app' ? (appId ? { type: 'app', appId } : null) : (macroId ? { type: 'macro', macroId } : null)
  return <>
    <div className="pf__row">
      <TextInput className="pf__grow" label="Name" value={value.name} onChange={name => onChange({ ...value, name })} maxLength={24} />
      <IconPicker value={value.icon} onChange={icon => onChange({ ...value, icon })} />
    </div>
    <Field label="Folder items">
      {value.items.map((it, i) => {
        if (!it) return null
        const appEntry = it.type === 'app' ? apps.find(a => a.id === it.appId) : undefined
        const macroEntry = it.type === 'macro' ? macros.find(m => m.id === it.macroId) : undefined
        const entry = appEntry ?? macroEntry
        return <div className="folder-item" key={i}>
          {appEntry ? <SlotIcon slot={appSlot(appEntry)} size={18} /> : <Icon name={entry?.icon ?? 'warning'} size={18} />}
          <span className="folder-item__name">{entry?.name ?? 'Missing item'}</span>
          <span className="pf__note">{it.type === 'app' ? 'App' : 'Macro'}</span>
          <IconButton icon="x" label={`Remove ${entry?.name ?? 'item'}`} onClick={() => onChange({ ...value, items: value.items.map((x, n) => n === i ? null : x) })} />
        </div>
      })}
      <Button icon="plus" variant="ghost" size="sm" className="self-start -ml-2 text-accent-foreground hover:bg-primary/14" disabled={full} onClick={() => setAdding(!adding)}>{full ? 'Folder is full' : 'Add to folder'}</Button>
      {adding && !full && <div className="folder-adder">
        <SegmentedControl aria-label="Item type" value={kind} options={[{ value: 'app', label: 'App' }, { value: 'macro', label: 'Macro' }]} onChange={setKind} />
        {kind === 'app' ? (
          <AppChooser apps={apps} value={appId} onChoose={a => setAppId(chooseApp(a))} />
        ) : (
          <MacroChooser macros={macros} value={macroId} onSelect={setMacroId} onUpsert={upsertMacro} goMacros={goMacros} />
        )}
        <Button variant="primary" className="w-full" disabled={!item} onClick={() => {
          const index = value.items.indexOf(null)
          if (index < 0 || !item) return
          onChange({ ...value, items: value.items.map((x, i) => i === index ? item : x) })
          setAppId(''); setAdding(false)
        }}>Add</Button>
      </div>}
    </Field>
  </>
}
