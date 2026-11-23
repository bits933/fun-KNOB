/**
 * The bridge between the UI windows and the main process.
 * `window.kreo` (set up in src/preload) implements KreoApi.
 * Owner: orchestrator. Agents must not edit this file; ask for changes in your report.
 */
import type { AppStatus, DialView, Gesture, Readout, Settings } from './types'

export interface PickedApp {
  name: string
  exePath: string
  processName: string
}

export type DjEvent = { type: 'active'; active: boolean } | { type: 'detent'; dir: -1 | 1 }

export interface KreoApi {
  // settings
  getSettings(): Promise<Settings>
  /** Replaces the whole settings object. Applies immediately. */
  setSettings(next: Settings): Promise<void>
  onSettings(cb: (s: Settings) => void): () => void
  /** Restore factory defaults. */
  resetSettings(): Promise<Settings>
  exportSettings(): Promise<boolean>
  importSettings(): Promise<boolean>

  // live state
  getStatus(): Promise<AppStatus>
  onStatus(cb: (s: AppStatus) => void): () => void
  getDialView(): Promise<DialView>
  onDialView(cb: (v: DialView) => void): () => void
  /** null = hide the readout. */
  onReadout(cb: (r: Readout | null) => void): () => void
  /** Every gesture, for the Test screen. */
  onGesture(cb: (g: Gesture) => void): () => void
  /** Suppresses the overlay ring and knob actions while the Test screen is visible. */
  setTestMode(active: boolean): void

  // DJ scratch audio runs in the overlay.
  onDj(cb: (event: DjEvent) => void): () => void
  touchDj(): void
  releaseDj(offsetMs: number | null): Promise<void>

  // actions
  /** Open a file picker for an .exe. null if cancelled. */
  pickApp(): Promise<PickedApp | null>
  /** Apps installed on this PC (from Start Menu shortcuts), sorted by name. */
  listInstalledApps(): Promise<PickedApp[]>
  /** The .exe's own icon as a PNG data URL (large size), or null if it has none / can't be read. */
  getAppIcon(exePath: string): Promise<string | null>
  runMacro(macroId: string): Promise<void>
  stopMacro(): Promise<void>

  // window
  minimizeWindow(): void
  closeWindow(): void
  /** Which window this is. */
  readonly windowKind: 'dashboard' | 'overlay'
}

/** IPC channel names. invoke = request/response, send = one-way to main, push = main → window. */
export const IPC = {
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  resetSettings: 'settings:reset',
  exportSettings: 'settings:export',
  importSettings: 'settings:import',
  pushSettings: 'settings:changed',

  getStatus: 'status:get',
  pushStatus: 'status:changed',
  getDialView: 'dial:get-view',
  pushDialView: 'dial:view',
  pushReadout: 'dial:readout',
  pushGesture: 'knob:gesture',
  setTestMode: 'knob:test-mode',
  pushDj: 'dj:event',
  touchDj: 'dj:touch',
  releaseDj: 'dj:release',

  pickApp: 'app:pick',
  listInstalledApps: 'app:list-installed',
  getAppIcon: 'app:icon',
  runMacro: 'macro:run',
  stopMacro: 'macro:stop',

  minimizeWindow: 'window:minimize',
  closeWindow: 'window:close'
} as const

declare global {
  interface Window {
    kreo: KreoApi
  }
}
