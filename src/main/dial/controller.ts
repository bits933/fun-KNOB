/**
 * The dial rules of PRD §4–7 as a pure state machine. No I/O, no timers: time is passed in.
 * Every method returns the effects to carry out, in order. A 'view' effect comes first
 * whenever the view changed.
 */
import type { DialController } from '@shared/contracts'
import { SYSTEM_META, SYSTEM_STEP } from '@shared/defaults'
import type {
  ActiveFunction,
  AppDef,
  CustomSlot,
  DialEffect,
  DialSlotView,
  DialView,
  FolderItem,
  Gesture,
  IconName,
  Macro,
  Readout,
  Settings,
  ShortcutSlot
} from '@shared/types'


/** What sits in one place of the ring at the current level. */
type Item =
  | { kind: 'system'; idx: number }
  | { kind: 'app'; app: AppDef }
  | { kind: 'macro'; macro: Macro }
  | { kind: 'folder'; idx: number; name: string; icon: IconName }
  | { kind: 'shortcut'; app: AppDef; idx: number; slot: ShortcutSlot }
  | { kind: 'empty' }

const EMPTY: Item = { kind: 'empty' }

const readout = (kind: Readout['kind'], icon: IconName, label: string, value: string | null = null): DialEffect => ({
  type: 'readout',
  readout: { kind, icon, label, value, percent: null }
})

/** Next index from `from` in direction `dir` whose place is filled, wrapping. `from` if none. */
function step(filled: boolean[], from: number, dir: 1 | -1): number {
  const n = filled.length
  for (let i = 1; i <= n; i++) {
    const j = (((from + dir * i) % n) + n) % n
    if (filled[j]) return j
  }
  return from
}

class Dial implements DialController {
  private isOpen = false
  /** Main-dial index (6 or 7) of the folder being shown, or the folder an app dial was entered from. */
  private folder: number | null = null
  /** App whose dial is shown. */
  private appId: string | null = null
  private highlight = 0
  private chosenTick = 0
  private act: ActiveFunction = { kind: 'system', slot: 0 }
  /** Index of the last system function chosen; the fallback when the active app is not in front. */
  private lastSystem = 0
  private foreground: string | null = null
  /** The "not in front" readout was already shown in this fallback episode. */
  private fallbackShown = false
  private availability: Record<string, boolean> = {}
  private macroRunning: string | null = null
  private lastInput: number

  constructor(
    private s: Settings,
    now: number
  ) {
    this.lastInput = now
    const def = this.defaultSlot()
    this.lastSystem = def >= 0 ? def : s.mainDial.slots.findIndex((x) => x.type === 'system')
    this.act = { kind: 'system', slot: this.lastSystem }
  }

  // ───────────── DialController ─────────────

  gesture(g: Gesture, now: number): DialEffect[] {
    if (!this.s.enabled) return []
    return this.track(() => {
      this.lastInput = now
      // PRD §5.4 / §11: pressing the knob while a macro runs only stops it (dial open or closed).
      if (this.macroRunning !== null && (g === 'click' || g === 'double' || g === 'long')) {
        return [{ type: 'stop-macro' }]
      }
      return this.isOpen ? this.openGesture(g) : this.closedGesture(g)
    })
  }

  setForeground(processName: string | null, _now: number): DialEffect[] {
    this.foreground = processName
    const app = this.activeApp()
    if (app && this.inFront(app)) this.fallbackShown = false
    return []
  }

  tick(now: number): DialEffect[] {
    return this.track(() => {
      if (this.isOpen && now >= this.lastInput + this.s.general.autoCloseMs) this.close(false)
      if (!this.isOpen && this.hasPendingDefaultReturn() && now >= this.lastInput + this.s.general.defaultReturnMs) {
        const def = this.defaultSlot()
        this.act = { kind: 'system', slot: def }
        this.lastSystem = def
        this.fallbackShown = false
      }
      return []
    })
  }

  nextDeadline(): number | null {
    if (this.isOpen) return this.lastInput + this.s.general.autoCloseMs
    return this.hasPendingDefaultReturn() ? this.lastInput + this.s.general.defaultReturnMs : null
  }

  /** Main-dial index of the default system control, or -1 (none configured / not on the dial). */
  private defaultSlot(): number {
    if (this.s.general.defaultControl === null) return -1
    return this.s.mainDial.slots.findIndex((x) => x.type === 'system' && x.control === this.s.general.defaultControl)
  }

  /** The knob is closed, on something other than the default, and will return to it after inactivity. */
  private hasPendingDefaultReturn(): boolean {
    const def = this.defaultSlot()
    return !this.isOpen && this.s.enabled && def >= 0 && (this.act.kind !== 'system' || this.act.slot !== def)
  }

  setSettings(s: Settings, now: number): DialEffect[] {
    return this.track(() => {
      const prevDefault = this.s.general.defaultControl
      this.s = s
      if (s.mainDial.slots[this.lastSystem]?.type !== 'system') this.lastSystem = s.mainDial.slots.findIndex(x => x.type === 'system')
      if (this.act.kind === 'system' ? s.mainDial.slots[this.act.slot]?.type !== 'system' : !this.activeSlot()) {
        this.act = { kind: 'system', slot: this.lastSystem }
      }
      if (this.appId !== null && !this.findApp(this.appId)) this.appId = null
      if (this.folder !== null && this.customAt(this.folder)?.type !== 'folder') this.folder = null
      if (!s.enabled) this.close(false)
      if (s.general.defaultControl !== prevDefault) {
        const def = this.defaultSlot()
        if (def >= 0) {
          this.act = { kind: 'system', slot: def }
          this.lastSystem = def
          this.fallbackShown = false
          this.lastInput = now
        }
      }
      if (!this.items()[this.highlight] || this.items()[this.highlight]?.kind === 'empty') this.highlight = this.startHighlight()
      return []
    })
  }

  setAppAvailability(availability: Record<string, boolean>): DialEffect[] {
    return this.track(() => {
      this.availability = { ...availability }
      return []
    })
  }

  setMacroRunning(macroId: string | null): void {
    this.macroRunning = macroId
  }

  view(): DialView {
    const items = this.items()
    const app = this.appId !== null ? this.findApp(this.appId) : undefined
    const folder = this.folder !== null ? this.customAt(this.folder) : undefined
    return {
      open: this.isOpen,
      level: app ? 'app' : folder ? 'folder' : 'main',
      levelLabel: app ? app.name : folder?.type === 'folder' ? folder.name : null,
      slots: items.map((it) => this.slotView(it)),
      highlight: this.highlight,
      hint: null,
      chosenTick: this.chosenTick
    }
  }

  active(): ActiveFunction {
    return { ...this.act }
  }

  // ───────────── gestures ─────────────

  private closedGesture(g: Gesture): DialEffect[] {
    const gs = this.s.gestures
    switch (g) {
      case 'rotate+':
      case 'rotate-':
        return this.turn(g === 'rotate+' ? 1 : -1)
      case 'click':
        this.isOpen = true
        this.folder = null
        // An app on the knob that is in front opens straight to its own shortcuts; back / long press reaches the main dial.
        this.appId = this.s.apps.find((app) => this.inFront(app) && app.slots.some(Boolean))?.id ?? null
        this.highlight = this.startHighlight()
        return []
      case 'double':
        return gs.closedDouble === 'none' ? [] : [{ type: gs.closedDouble }]
      case 'long':
        return gs.closedLong === 'mute' ? [{ type: 'mute' }] : []
      case 'hold-rotate+':
      case 'hold-rotate-':
        return gs.holdRotate === 'cycle' ? this.cycle(g === 'hold-rotate+' ? 1 : -1) : []
    }
  }

  private openGesture(g: Gesture): DialEffect[] {
    const items = this.items()
    const item = items[this.highlight]
    switch (g) {
      case 'rotate+':
      case 'rotate-':
        this.highlight = step(
          items.map((it) => it.kind !== 'empty'),
          this.highlight,
          g === 'rotate+' ? 1 : -1
        )
        return []
      case 'click':
        return this.choose(item)
      case 'double':
        if (item.kind !== 'app') return this.back()
        this.appId = item.app.id
        this.highlight = this.startHighlight()
        return []
      case 'long':
        return this.back()
      default:
        return []
    }
  }

  /** Rotate with the dial closed: drive the active function (PRD §7). */
  private turn(dir: 1 | -1): DialEffect[] {
    const app = this.activeApp()
    const slot = this.activeSlot()
    if (!app || !slot) return this.systemTurn(this.act.kind === 'system' ? this.act.slot : this.lastSystem, dir)
    if (this.inFront(app)) {
      const stroke = dir > 0 ? slot.right : slot.left
      return stroke ? [{ type: 'stroke', appId: app.id, stroke, dir, label: slot.name, icon: slot.icon }] : []
    }
    const fx = this.systemTurn(this.lastSystem, dir)
    if (!this.fallbackShown) {
      this.fallbackShown = true
      const meta = SYSTEM_META[this.systemAt(this.lastSystem).control]
      fx.push(readout('message', meta.icon, `${app.name} not in front: ${meta.name}`))
    }
    return fx
  }

  private systemTurn(idx: number, dir: 1 | -1): DialEffect[] {
    const { control, step } = this.systemAt(idx)
    return [{ type: 'system', control, dir, step }]
  }

  /** Hold + rotate with the dial closed: previous / next function of the current set. */
  private cycle(dir: 1 | -1): DialEffect[] {
    const app = this.activeApp()
    if (app && this.act.kind === 'app') {
      const slot = step(app.slots.map((x) => x !== null), this.act.slot, dir)
      this.act = { kind: 'app', appId: app.id, slot }
      const s = app.slots[slot]!
      return [readout('message', s.icon, s.name)]
    }
    const system = this.s.mainDial.slots
    if (!system.some(x => x.type === 'system')) return []
    const slot = step(system.map(x => x.type === 'system'), this.lastSystem, dir)
    this.act = { kind: 'system', slot }
    this.lastSystem = slot
    const meta = SYSTEM_META[this.systemAt(slot).control]
    return [readout('message', meta.icon, meta.name)]
  }

  private choose(item: Item): DialEffect[] {
    switch (item.kind) {
      case 'system':
        this.act = { kind: 'system', slot: item.idx }
        this.lastSystem = item.idx
        this.close(true)
        return []
      case 'folder':
        this.folder = item.idx
        this.highlight = this.startHighlight()
        return []
      case 'app':
        if (this.isMissing(item.app)) {
          this.close(false)
          return [this.missingReadout(item.app)]
        }
        this.close(true)
        return [{ type: 'open-app', appId: item.app.id }]
      case 'macro': {
        const id = item.macro.id
        this.close(true)
        return [this.macroRunning === id ? { type: 'stop-macro' } : { type: 'run-macro', macroId: id }]
      }
      case 'shortcut':
        this.act = { kind: 'app', appId: item.app.id, slot: item.idx }
        this.fallbackShown = false
        this.close(true)
        // PRD §5.3: choosing an app function brings the app to the front (starting it if needed).
        return [this.isMissing(item.app) ? this.missingReadout(item.app) : { type: 'open-app', appId: item.app.id }]
      case 'empty':
        return []
    }
  }

  /** Back one level; closes the dial at the main level. */
  private back(): DialEffect[] {
    if (this.appId !== null) {
      const id = this.appId
      this.appId = null
      const i = this.items().findIndex((it) => it.kind === 'app' && it.app.id === id)
      this.highlight = i >= 0 ? i : this.startHighlight()
    } else if (this.folder !== null) {
      this.highlight = this.folder
      this.folder = null
    } else {
      this.close(false)
    }
    return []
  }

  private close(chosen: boolean): void {
    this.isOpen = false
    this.folder = this.appId = null
    if (chosen) this.chosenTick++
  }

  // ───────────── helpers ─────────────

  /** Emit a 'view' effect first if `fn` changed the view. */
  private track(fn: () => DialEffect[]): DialEffect[] {
    const before = JSON.stringify(this.view())
    const fx = fn()
    const view = this.view()
    return JSON.stringify(view) === before ? fx : [{ type: 'view', view }, ...fx]
  }

  /** The places of the current level. */
  private items(): Item[] {
    let list: Item[]
    const app = this.appId !== null ? this.findApp(this.appId) : undefined
    const folder = this.folder !== null ? this.customAt(this.folder) : undefined
    if (app) {
      list = app.slots.map((slot, idx) => (slot ? { kind: 'shortcut', app, idx, slot } : EMPTY))
    } else if (folder?.type === 'folder') {
      list = folder.items.map((it) => this.resolve(it))
    } else {
      list = this.s.mainDial.slots.map((c, idx): Item => c.type === 'system' ? {kind:'system', idx} : c.type === 'folder' ? {kind:'folder', idx, name:c.name, icon:c.icon} : this.resolve(c))
    }
    return list
  }

  private resolve(it: FolderItem | CustomSlot | null): Item {
    if (it?.type === 'app') {
      const app = this.findApp(it.appId)
      return app ? { kind: 'app', app } : EMPTY
    }
    if (it?.type === 'macro') {
      const macro = this.s.macros.find((m) => m.id === it.macroId)
      return macro ? { kind: 'macro', macro } : EMPTY
    }
    return EMPTY
  }

  private slotView(it: Item): DialSlotView {
    const v = (kind: DialSlotView['kind'], name: string, icon: IconName): DialSlotView => ({
      kind, name, icon, active: this.isActive(it), missing: it.kind === 'app' && this.isMissing(it.app)
    })
    switch (it.kind) {
      case 'system': {
        const meta = SYSTEM_META[this.systemAt(it.idx).control]
        return v('system', meta.name, meta.icon)
      }
      case 'app':
        return it.app.exePath ? { ...v('app', it.app.name, it.app.icon), exePath: it.app.exePath } : v('app', it.app.name, it.app.icon)
      case 'macro':
        return v('macro', it.macro.name, it.macro.icon)
      case 'folder':
        return v('folder', it.name, it.icon)
      case 'shortcut':
        return v('shortcut', it.slot.name, it.slot.icon)
      case 'empty':
        return v('empty', '', 'empty-slot')
    }
  }

  private isActive(it: Item): boolean {
    const a = this.act
    if (it.kind === 'system') return a.kind === 'system' && a.slot === it.idx
    if (it.kind === 'shortcut') return a.kind === 'app' && a.appId === it.app.id && a.slot === it.idx
    return false
  }

  /** Highlight when a level opens: the active function if visible, else the first filled place. */
  private startHighlight(): number {
    const items = this.items()
    const active = items.findIndex((it) => this.isActive(it))
    if (active >= 0) return active
    return Math.max(0, items.findIndex((it) => it.kind !== 'empty'))
  }

  private systemAt(idx: number) {
    const s = this.s.mainDial.slots[idx]
    return s?.type === 'system' ? s : { control: 'volume' as const, step: SYSTEM_STEP.volume }
  }

  private customAt(mainIdx: number) {
    return this.s.mainDial.slots[mainIdx]
  }

  private findApp(id: string): AppDef | undefined {
    return this.s.apps.find((a) => a.id === id)
  }

  private activeApp(): AppDef | undefined {
    return this.act.kind === 'app' ? this.findApp(this.act.appId) : undefined
  }

  private activeSlot(): ShortcutSlot | null | undefined {
    return this.act.kind === 'app' ? this.activeApp()?.slots[this.act.slot] : undefined
  }

  private inFront(app: AppDef): boolean {
    return this.foreground !== null && this.foreground.toLowerCase() === app.processName.toLowerCase()
  }

  /** Unknown availability counts as present. */
  private isMissing(app: AppDef): boolean {
    return this.availability[app.id] === false
  }

  private missingReadout(app: AppDef): DialEffect {
    return readout('warning', 'warning', `${app.name} not found`, 'Locate app')
  }
}

export function createDialController(settings: Settings, now: number): DialController {
  return new Dial(settings, now)
}
