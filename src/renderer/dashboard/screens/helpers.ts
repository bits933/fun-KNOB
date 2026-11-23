/**
 * Pure helpers shared by the Main dial / Apps / Macros / First run screens (no React, easy to test).
 */
import { defaultSettings, SYSTEM_META } from '@shared/defaults'
import type { AppDef, CustomSlot, MainSlot, DialSlotView, DialView, FolderItem, Settings, ShortcutSlot, Stroke, SystemControl } from '@shared/types'
import { MAX_SLOTS, MIN_SLOTS } from '@shared/types'

/** Restore the whole Main dial, including folder contents, while keeping other settings. */
export function resetMainDial(s: Settings): void {
  s.mainDial = defaultSettings().mainDial
}

/** Unit text and slider range of the step size per system control. */
export const STEP_RANGE: Record<SystemControl, { min: number; max: number; unit: string }> = {
  volume: { min: 1, max: 10, unit: '%' },
  brightness: { min: 1, max: 20, unit: '%' },
  scroll: { min: 1, max: 10, unit: ' lines' },
  zoom: { min: 1, max: 5, unit: ' notches' },
  media: { min: 1, max: 5, unit: ' presses' },
  dj: { min: 1, max: 1, unit: '' },
  'switch-apps': { min: 1, max: 3, unit: ' windows' },
  'undo-redo': { min: 1, max: 5, unit: ' steps' },
  'virtual-desktops': { min: 1, max: 3, unit: ' desktops' },
  mic: { min: 1, max: 10, unit: '%' }
}

/** `{ exePath }` for an app that has one, so app slots can show the real .exe icon (SlotIcon). */
export const exeOf = (a?: { exePath?: string }): { exePath?: string } => (a?.exePath ? { exePath: a.exePath } : {})

/** A minimal app slot, so app lists can draw the real .exe icon with SlotIcon. */
export const appSlot = (a: { name: string; icon?: string; exePath?: string }): DialSlotView =>
  ({ kind: 'app', name: a.name, icon: a.icon ?? 'apps-folder', active: false, missing: false, ...exeOf(a) })

const empty = (): DialSlotView => ({ kind: 'empty', name: '+ Add', icon: 'empty-slot', active: false, missing: false })

/** The slots of the main dial as the dashboard draws them (independent of the live overlay). */
export function mainDialView(s: Settings, highlight: number): DialView {
  const custom = (c: MainSlot): DialSlotView => {
    if (c.type === 'system') return {kind:'system', name:SYSTEM_META[c.control].name, icon:SYSTEM_META[c.control].icon, active:false, missing:false}
    if (c.type === 'folder') return { kind: 'folder', name: c.name || 'Folder', icon: c.icon, active: false, missing: false }
    if (c.type === 'app') {
      const a = s.apps.find((x) => x.id === c.appId)
      return { kind: 'app', name: a?.name ?? 'App', icon: a?.icon ?? 'empty-slot', active: false, missing: !a, ...exeOf(a) }
    }
    if (c.type === 'macro') {
      const m = s.macros.find((x) => x.id === c.macroId)
      return { kind: 'macro', name: m?.name ?? 'Macro', icon: m?.icon ?? 'macros', active: false, missing: !m }
    }
    return empty()
  }
  const slots = s.mainDial.slots.map(custom)
  return { open: false, level: 'main', levelLabel: null, slots, highlight, hint: null, chosenTick: 0 }
}

/** One app's shortcut slots as a dial. `missing` is for apps that cannot be found (only affects labels elsewhere). */
export function appDialView(app: AppDef, highlight: number): DialView {
  const slots = app.slots.map((x): DialSlotView =>
    x ? { kind: 'shortcut', name: x.name, icon: x.icon, active: false, missing: false } : empty()
  )
  return { open: false, level: 'app', levelLabel: app.name, slots, highlight, hint: null, chosenTick: 0 }
}

/** Legend text under a slot name, e.g. "Folder · 4 apps". */
export function slotKindText(s: Settings, i: number): string {
  const c = s.mainDial.slots[i]
  if (c.type === 'system') return 'System'
  if (c.type === 'empty') return 'Empty'
  if (c.type === 'app') return 'App'
  if (c.type === 'macro') return 'Macro'
  const n = c.items.filter(Boolean).length
  if (n === 0) return 'Folder · empty'
  const apps = c.items.filter((x) => x?.type === 'app').length
  const macros = n - apps
  const parts = [apps && `${apps} ${apps === 1 ? 'app' : 'apps'}`, macros && `${macros} ${macros === 1 ? 'macro' : 'macros'}`].filter(Boolean)
  return `Folder · ${parts.join(', ')}`
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

type Ref = { appId: string } | { macroId: string }
const same = (it: FolderItem | MainSlot | null, ref: Ref): boolean =>
  !!it && ('appId' in ref ? it.type === 'app' && it.appId === ref.appId : it.type === 'macro' && it.macroId === ref.macroId)

/** Where an app or macro is placed on the main dial, e.g. ["Slot 7 (Apps folder)", "Slot 8"]. */
export function usages(s: Settings, ref: Ref): string[] {
  const out: string[] = []
  s.mainDial.slots.forEach((c, i) => {
    const slot = i + 1
    if (same(c, ref)) out.push(`Slot ${slot}`)
    else if (c.type === 'folder' && c.items.some((it) => same(it, ref))) out.push(`Slot ${slot} (${c.name || 'Folder'} folder)`)
  })
  return out
}

/** Empties every slot / folder place that points at the app or macro. Mutates `draft`. */
export function removeRefs(draft: Settings, ref: Ref): void {
  draft.mainDial.slots = draft.mainDial.slots.map((c): MainSlot => {
    if (same(c, ref)) return { type: 'empty' }
    if (c.type === 'folder') return { ...c, items: c.items.map((it) => (same(it, ref) ? null : it)) }
    return c
  }) as Settings['mainDial']['slots']
}

/** Folder items: preserve places and bound the ring to 4–8. */
export function padItems(items: (FolderItem | null)[]): (FolderItem | null)[] {
  const count = Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, items.length))
  return Array.from({length: count}, (_, i) => items[i] ?? null)
}

/** Text for a stroke that the recorder cannot show, e.g. "Mouse wheel up + Shift". null for key strokes. */
export function wheelText(s: Stroke | null): string | null {
  if (!s || s.type !== 'wheel') return null
  return ['Mouse wheel ' + s.dir, ...s.mods].join(' + ')
}

export const strokeKeys = (s: Stroke | null): string[] | null => (s && s.type === 'keys' ? s.keys : null)

/** Name of another slot of the same app that already uses this exact key combination, or null. */
export function strokeConflict(app: AppDef, index: number, keys: string[] | null): string | null {
  if (!keys || keys.length === 0) return null
  const key = keys.join('+')
  for (let i = 0; i < app.slots.length; i++) {
    const sl: ShortcutSlot | null = app.slots[i]
    if (i === index || !sl) continue
    for (const st of [sl.left, sl.right]) {
      if (st && st.type === 'keys' && st.keys.join('+') === key) return `Already used by ${sl.name}`
    }
  }
  return null
}

/** How many of an app's slots are filled, as text ("8 shortcuts"). */
export const shortcutCount = (app: AppDef): string => {
  const n = app.slots.filter(Boolean).length
  return n === 0 ? 'No shortcuts' : plural(n, 'shortcut')
}

/** A fresh id like "macro-lq3x9a2k". */
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export interface DialPath { custom: number | null; appId: string | null; place: number | null }

/** Invalid or removed destinations always return to the main dial. */
export function validDialPath(s: Settings, path: DialPath): boolean {
  const c = path.custom === null ? null : s.mainDial.slots[path.custom]
  if (path.custom !== null && c?.type !== 'folder') return false
  if (!path.appId) return true
  if (!s.apps.some(a => a.id === path.appId)) return false
  const source = c?.type === 'folder' ? c.items[path.place ?? -1] : s.mainDial.slots[path.place ?? -1]
  return source?.type === 'app' && source.appId === path.appId
}

/** Swap in place order without compacting empty slots or mutating the source. */
export function swapSlots<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length) return next
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export function folderDialView(s: Settings, folder: Extract<CustomSlot, { type: 'folder' }>): DialView {
  const slots = folder.items.map(it => {
    if (!it) return empty()
    const item = it.type === 'app' ? s.apps.find(a => a.id === it.appId) : s.macros.find(m => m.id === it.macroId)
    return { kind: it.type, name: item?.name ?? 'Missing item', icon: item?.icon ?? 'warning', missing: !item, active: false, ...(item && 'exePath' in item ? exeOf(item) : {}) }
  })
  return { open: false, level: 'folder', levelLabel: folder.name, slots, highlight: 0, hint: null, chosenTick: 0 }
}
