/**
 * Interfaces between modules. Each module implements or consumes these and nothing else,
 * so modules can be built and tested separately against fakes.
 * Owner: orchestrator. Agents must not edit this file; ask for changes in your report.
 */
import type {
  ActiveFunction,
  DialEffect,
  DialView,
  Gesture,
  KeyName,
  RawKnobEvent,
  Readout,
  Settings,
  Stroke
} from './types'

// ───────────── src/main/native ─────────────

export interface ForegroundApp {
  /** e.g. 'Photoshop.exe' */
  processName: string
  exePath: string
  pid: number
}

export interface Stoppable {
  stop(): void
}

export interface MediaTouch {
  positionMs: number
  endMs: number
  wasPlaying: boolean
}

export interface DjMedia {
  primeMedia(): Promise<boolean>
  touchMedia(): Promise<MediaTouch | null>
  releaseMedia(positionMs?: number): Promise<boolean>
}

export interface NativeApi {
  /**
   * Install the knob hook. Hardware (non-injected) Volume Up / Volume Down / Mute keys are
   * swallowed and reported through onEvent. Injected keys (ours or other software's) pass through.
   * While `setPassthrough(true)` the knob keys are NOT swallowed and NOT reported (app paused).
   * onError is called if the hook cannot be installed or is lost.
   */
  startKnobHook(onEvent: (e: RawKnobEvent) => void, onError: (err: Error) => void): Stoppable & {
    setPassthrough(on: boolean): void
  }

  /** Press and release a key combination, or turn the mouse wheel, `repeat` times. Injected. */
  sendStroke(stroke: Stroke, repeat?: number): void
  /** Press or release one key and leave it in that state (e.g. hold Alt while Tab is tapped). Injected. */
  keyDown(key: KeyName): void
  keyUp(key: KeyName): void
  /** Type literal text into the focused window. */
  typeText(text: string): void

  getForeground(): ForegroundApp | null
  /** Calls back whenever the foreground app changes (and once immediately). */
  watchForeground(cb: (app: ForegroundApp | null) => void): Stoppable
  isProcessRunning(processName: string): boolean
  /** Bring a running app's main window to the front. false if it is not running. */
  focusProcess(processName: string): boolean

  /** Master output volume, 0–100. null if it cannot be read. */
  getVolume(): number | null
  setVolume(percent: number): void
  getMuted(): boolean | null
  setMuted(muted: boolean): void
  /** Default microphone level, 0–100. null if there is no microphone. */
  getMicVolume(): number | null
  setMicVolume(percent: number): void

  /** Screen brightness 0–100. null = not supported on this screen. */
  getBrightness(): Promise<number | null>
  /** false = not supported on this screen. */
  setBrightness(percent: number): Promise<boolean>

  /** Release everything (hook, watchers, child processes). */
  dispose(): void
}

// ───────────── src/main/dial ─────────────

/**
 * Pure state machine for PRD §4–7. No I/O, no timers: time is passed in (ms, monotonic).
 * Every method returns the effects to carry out, in order.
 */
export interface DialController {
  gesture(g: Gesture, now: number): DialEffect[]
  /** Foreground process changed. null = unknown. */
  setForeground(processName: string | null, now: number): DialEffect[]
  /** Call when `nextDeadline()` has passed (auto-close). */
  tick(now: number): DialEffect[]
  /** Time of the next thing `tick` needs to handle, or null. */
  nextDeadline(): number | null
  setSettings(s: Settings, now: number): DialEffect[]
  setAppAvailability(availability: Record<string, boolean>): DialEffect[]
  setMacroRunning(macroId: string | null): void
  view(): DialView
  active(): ActiveFunction
}

// ───────────── src/main/settings ─────────────

export interface SettingsStore {
  /** Absolute path of the JSON file. */
  readonly path: string
  get(): Settings
  /** Validates, saves to disk, then notifies listeners. */
  set(next: Settings): void
  onChange(cb: (s: Settings) => void): () => void
}

// ───────────── src/main/actions ─────────────

/** Effects the actions layer carries out (everything except 'view' and 'readout'). */
export type ActionEffect = Exclude<DialEffect, { type: 'view' } | { type: 'readout' }>

export interface Actions {
  /** Carry out one effect. Resolves with the readout to show, or null. Never throws. */
  run(effect: ActionEffect, settings: Settings): Promise<Readout | null>
  /** appId → can the app be found. */
  checkApps(settings: Settings): Record<string, boolean>
  /** Stop a running macro, if any. */
  stopMacro(): void
  onMacroState(cb: (macroId: string | null) => void): () => void
}
