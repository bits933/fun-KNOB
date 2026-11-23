/**
 * Shared data types. The single source of truth for every module.
 * Owner: orchestrator. Agents must not edit this file; ask for changes in your report.
 */

// ───────────────────────── Knob input ─────────────────────────

/** A raw event from the keyboard hook. cw = Volume Up key, ccw = Volume Down, press/release = Mute key. */
export interface RawKnobEvent {
  kind: 'cw' | 'ccw' | 'press' | 'release'
}

export type Gesture = 'rotate+' | 'rotate-' | 'click' | 'double' | 'long' | 'hold-rotate+' | 'hold-rotate-'

// ───────────────────────── Key strokes ─────────────────────────

/** A key name from `KEY_VK` in keys.ts, e.g. 'Ctrl', 'Shift', '[', 'Left', 'Num4'. */
export type KeyName = string

/** One thing sent to the focused app. `keys` lists modifiers first, e.g. ['Ctrl','Shift','[']. */
export type Stroke =
  | { type: 'keys'; keys: KeyName[] }
  | { type: 'wheel'; dir: 'up' | 'down' | 'left' | 'right'; mods: KeyName[] }

// ───────────────────────── Settings ─────────────────────────

/** Icon file name without extension, from src/renderer/icons/svg. */
export type IconName = string

export type SystemControl =
  | 'volume'
  | 'brightness'
  | 'scroll'
  | 'zoom'
  | 'media'
  | 'dj'
  | 'switch-apps'
  | 'undo-redo'
  | 'virtual-desktops'
  | 'mic'

export interface SystemSlot {
  control: SystemControl
  /** Amount per knob step. Meaning depends on the control: percent, lines, notches, presses. */
  step: number
}

/** One slot of an app dial: a pair of strokes for turning left / right. */
export interface ShortcutSlot {
  name: string
  icon: IconName
  left: Stroke | null
  right: Stroke | null
  /** Optional stroke sent when the knob is clicked while this function is active and the dial is closed. Unused in v1 gestures; stored for later. */
  click: Stroke | null
}

export interface AppDef {
  id: string
  name: string
  icon: IconName
  /** Full path to the .exe. '' = not located yet. */
  exePath: string
  /** File name of the process, e.g. 'Photoshop.exe'. Compared case-insensitively. */
  processName: string
  /** Length 4–8. null = empty slot. */
  slots: (ShortcutSlot | null)[]
}

export type MacroStep =
  | { type: 'keys'; keys: KeyName[] }
  | { type: 'text'; text: string }
  | { type: 'open'; target: string }
  | { type: 'wait'; ms: number }

export interface Macro {
  id: string
  name: string
  icon: IconName
  /** At most MAX_MACRO_STEPS. */
  steps: MacroStep[]
}

export type FolderItem = { type: 'app'; appId: string } | { type: 'macro'; macroId: string }

export type CustomSlot =
  | { type: 'empty' }
  | { type: 'app'; appId: string }
  | { type: 'macro'; macroId: string }
  /** items is length 4–8. null = empty place. */
  | { type: 'folder'; name: string; icon: IconName; items: (FolderItem | null)[] }

export type MainSlot = ({ type: 'system' } & SystemSlot) | CustomSlot

export interface GestureSettings {
  doubleClickMs: number
  longPressMs: number
  holdChainMs: number
  /** Double click while the dial is closed. */
  closedDouble: 'play-pause' | 'next-track' | 'none'
  /** Long press while the dial is closed. */
  closedLong: 'mute' | 'none'
  /** Hold + rotate while the dial is closed. */
  holdRotate: 'cycle' | 'none'
}

export type LevelPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'

export interface GeneralSettings {
  startWithWindows: boolean
  runAsAdmin: boolean
  showReadout: boolean
  /** 60–140. 100 = the 600 px Figma dial shown at 420 px. */
  dialSizePercent: number
  /** 40–140. Size of the Volume / Brightness / Mic level ring only. */
  levelSizePercent: number
  /** Where the dial and the level ring sit on the screen (32 px from the edges). */
  levelPosition: LevelPosition
  autoCloseMs: number
  opensOn: 'cursor-screen' | 'primary-screen'
  /** System control that the knob starts on and returns to after `defaultReturnMs` of inactivity. `null` = disabled. */
  defaultControl: SystemControl | null
  /** Milliseconds of knob inactivity before returning to `defaultControl` (default 20_000 = 20 s). */
  defaultReturnMs: number
  firstRunDone: boolean
}

export interface Settings {
  version: 2
  /** false = paused: the knob behaves as a normal volume knob. */
  enabled: boolean
  mainDial: {
    slots: MainSlot[]
  }
  apps: AppDef[]
  macros: Macro[]
  gestures: GestureSettings
  general: GeneralSettings
}

export const MIN_SLOTS = 4
export const MAX_SLOTS = 8
export const MAX_MACRO_STEPS = 20

// ───────────────────────── Dial state shown by the overlay ─────────────────────────

export type DialLevel = 'main' | 'folder' | 'app'
export type SlotKind = 'system' | 'app' | 'macro' | 'folder' | 'shortcut' | 'empty'

export interface DialSlotView {
  kind: SlotKind
  name: string
  icon: IconName
  /** This slot is the currently active function (shown with a small dot). */
  active: boolean
  /** App slot whose app cannot be found. */
  missing: boolean
  /** App slots only: the app's .exe, so the UI can show its real icon (see SlotIcon). */
  exePath?: string
}

export interface DialView {
  open: boolean
  level: DialLevel
  /** null on the main dial. Folder name or app name otherwise. */
  levelLabel: string | null
  /** Length 4–8. Index 0 = top, clockwise. */
  slots: DialSlotView[]
  /** 0–7. */
  highlight: number
  /** Small text under the name, e.g. 'Click: open · Double click: controls'. */
  hint: string | null
  /** Increases by 1 each time a slot is chosen, so the overlay can play the "chosen" pulse. */
  chosenTick: number
}

export interface Readout {
  kind: 'value' | 'message' | 'warning'
  icon: IconName
  label: string
  /** Right-hand text, e.g. '45%'. */
  value: string | null
  /** 0–100 when a bar should be shown, else null. */
  percent: number | null
}

/** The function the knob drives while the dial is closed. */
export type ActiveFunction =
  | { kind: 'system'; slot: number }
  | { kind: 'app'; appId: string; slot: number }

// ───────────────────────── Effects produced by the dial controller ─────────────────────────

export type DialEffect =
  /** The view changed; send it to the overlay. */
  | { type: 'view'; view: DialView }
  /** Turn a system control one knob step. */
  | { type: 'system'; control: SystemControl; dir: 1 | -1; step: number }
  /** Send an app shortcut. `label` and `icon` are for the readout. */
  | { type: 'stroke'; appId: string; stroke: Stroke; dir: 1 | -1; label: string; icon: IconName }
  /** Open the app, or bring it to the front. */
  | { type: 'open-app'; appId: string }
  | { type: 'run-macro'; macroId: string }
  | { type: 'stop-macro' }
  | { type: 'play-pause' }
  | { type: 'next-track' }
  | { type: 'mute' }
  /** Show a message or warning pill (value readouts come from the actions layer). */
  | { type: 'readout'; readout: Readout }

// ───────────────────────── Status shown by the dashboard ─────────────────────────

export interface AppStatus {
  enabled: boolean
  hook: 'starting' | 'ok' | 'failed'
  /** Which mechanism catches the knob keys. */
  hookKind: 'native' | 'helper' | 'none'
  active: { label: string; icon: IconName }
  /** appId → can the app be found (exe exists or it is running). */
  appAvailability: Record<string, boolean>
  macroRunning: string | null
}
