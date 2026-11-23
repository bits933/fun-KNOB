import { existsSync } from 'node:fs'
import type { Actions, NativeApi } from '../../shared/contracts'
import type { Readout, Stroke } from '../../shared/types'
import { createMacroRunner } from '../macros/runner'

export function createActions(deps: { native: NativeApi; openTarget(target: string): Promise<void>; launchApp(exePath: string): Promise<void>; turnDj(dir: -1 | 1): void; now?(): number; keyDown?(key: string): void; keyUp?(key: string): void }): Actions & { dispose(): void } {
  const n = deps.native
  const runner = createMacroRunner({ sendStroke: s => n.sendStroke(s), typeText: t => n.typeText(t), open: deps.openTarget })
  const readout = (kind: Readout['kind'], icon: string, label: string, value: string | null = null, percent: number | null = null): Readout => ({ kind, icon, label, value, percent })
  const warning = (label: string) => readout('warning', 'warning', label)
  const clamp = (n: number) => Math.max(0, Math.min(100, n))
  const value = (icon: string, label: string, v: number) => readout('value', icon, label, `${v}%`, v)
  const send = (keys: string[], repeat = 1) => n.sendStroke({ type: 'keys', keys }, repeat)
  let alt = false, timer: ReturnType<typeof setTimeout> | undefined
  const release = () => { if (timer) clearTimeout(timer); timer = undefined; if (alt) { alt = false; deps.keyUp?.('Alt') } }
  let brightness: number | null = null, pending: number | null = null, setting = false
  const setBrightness = async () => {
    if (setting) return
    setting = true
    try { while (pending !== null) { const target = pending; pending = null; if (!await n.setBrightness(target)) { brightness = null; pending = null; break } } }
    catch { brightness = null; pending = null }
    finally { setting = false }
  }
  return {
    async run(effect, settings) {
      try {
        if (effect.type === 'stroke') { n.sendStroke(effect.stroke); return readout('message', effect.icon, effect.label, effect.dir > 0 ? '+' : '−') }
        if (effect.type === 'open-app') {
          const app = settings.apps.find(a => a.id === effect.appId)
          if (!app) return warning('App not found')
          // Running with no visible window (e.g. Figma hidden in the background) can't be focused; starting it again re-shows it.
          if (n.isProcessRunning(app.processName) && n.focusProcess(app.processName)) { /* in front */ }
          else if (app.exePath && existsSync(app.exePath)) await deps.launchApp(app.exePath)
          else return warning(`${app.name} not found`)
          return readout('message', app.icon, `Opening ${app.name}`)
        }
        if (effect.type === 'run-macro') {
          const macro = settings.macros.find(m => m.id === effect.macroId)
          if (!macro) return warning('Macro not found')
          void runner.run(macro)
          return readout('message', macro.icon, `Running: ${macro.name}`)
        }
        if (effect.type === 'stop-macro') { runner.stop(); return null }
        if (effect.type === 'play-pause' || effect.type === 'next-track') { send([effect.type === 'play-pause' ? 'MediaPlayPause' : 'MediaNext']); return null }
        if (effect.type === 'mute') { const muted = n.getMuted(); if (muted === null) return warning('Volume unavailable'); n.setMuted(!muted); const v = n.getVolume(); return readout('value', 'volume', 'Volume', !muted ? 'Muted' : v === null ? null : `${v}%`, !muted ? null : v) }
        const { control, dir, step } = effect
        if (control === 'dj') { deps.turnDj(dir); return readout('message', 'dj', 'DJ') }
        if (control === 'volume' || control === 'mic') {
          const v = control === 'volume' ? n.getVolume() : n.getMicVolume()
          if (v === null) return warning(control === 'mic' ? 'Microphone unavailable' : 'Volume unavailable')
          const target = clamp(v + dir * step)
          if (control === 'volume') { n.setVolume(target); if (dir > 0 && n.getMuted()) n.setMuted(false) } else n.setMicVolume(target)
          return value(control, control === 'mic' ? 'Mic' : 'Volume', target)
        }
        if (control === 'brightness') {
          if (brightness === null) brightness = await n.getBrightness()
          if (brightness === null) return warning('Brightness not supported on this screen')
          brightness = clamp(brightness + dir * step); pending = brightness; void setBrightness()
          return value('brightness', 'Brightness', brightness)
        }
        if (control === 'scroll' || control === 'zoom') {
          // Clockwise scrolls down and zooms in.
          const stroke: Stroke = { type: 'wheel', dir: control === 'scroll' ? (dir > 0 ? 'down' : 'up') : (dir > 0 ? 'up' : 'down'), mods: control === 'zoom' ? ['Ctrl'] : [] }
          n.sendStroke(stroke, step); return readout('message', control, control === 'scroll' ? 'Scroll' : 'Zoom')
        }
        if (control === 'media') { send([dir > 0 ? 'Right' : 'Left'], step); return readout('message', 'media', 'Media', dir > 0 ? 'Forward' : 'Back') }
        if (control === 'switch-apps') {
          if (deps.keyDown && deps.keyUp) { if (!alt) { deps.keyDown('Alt'); alt = true }; send(dir > 0 ? ['Tab'] : ['Shift', 'Tab'], step); if (timer) clearTimeout(timer); timer = setTimeout(() => { try { release() } catch { /* timer cannot report errors */ } }, 700) }
          else send(dir > 0 ? ['Alt', 'Tab'] : ['Alt', 'Shift', 'Tab'], step)
          return readout('message', 'switch-apps', 'Switch apps')
        }
        if (control === 'undo-redo') { send(dir > 0 ? ['Ctrl', 'Shift', 'Z'] : ['Ctrl', 'Z'], step); return readout('message', control, dir > 0 ? 'Redo' : 'Undo') }
        send(['Ctrl', 'Win', dir > 0 ? 'Right' : 'Left'], step); return readout('message', control, 'Virtual desktops')
      } catch { return warning('Action failed') }
    },
    checkApps(settings) { return Object.fromEntries(settings.apps.map(a => { try { return [a.id, n.isProcessRunning(a.processName) || (!!a.exePath && existsSync(a.exePath))] } catch { return [a.id, !!a.exePath && existsSync(a.exePath)] } })) },
    stopMacro: () => runner.stop(), onMacroState: cb => runner.onState(cb),
    dispose() { runner.stop(); try { release() } catch { /* cleanup is best effort */ } }
  }
}
