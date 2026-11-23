/**
 * In-memory KreoApi used when `window.kreo` is missing (browser, `scripts/capture.cjs`).
 * URL flags: `?paused=1` starts paused, `?test-demo=1` emits fake gestures for the Test screen,
 * `?missing=blender,figma` marks apps as not found, `?demo-macros=1` adds three sample macros.
 */
import type { KreoApi } from '@shared/api'
import { SYSTEM_META, defaultSettings } from '@shared/defaults'
import type { AppStatus, CustomSlot, DialSlotView, DialView, Gesture, Readout, Settings } from '@shared/types'

const DEMO: Gesture[] = ['rotate+', 'rotate+', 'click', 'rotate-', 'double', 'long', 'hold-rotate+']

function customSlotView(s: CustomSlot, settings: Settings): DialSlotView {
  if (s.type === 'folder') return { kind: 'folder', name: s.name, icon: s.icon, active: false, missing: false }
  if (s.type === 'app') {
    const app = settings.apps.find((a) => a.id === s.appId)
    return { kind: 'app', name: app?.name ?? 'App', icon: app?.icon ?? 'empty-slot', active: false, missing: !app, ...(app?.exePath ? { exePath: app.exePath } : {}) }
  }
  if (s.type === 'macro') {
    const m = settings.macros.find((x) => x.id === s.macroId)
    return { kind: 'macro', name: m?.name ?? 'Macro', icon: m?.icon ?? 'macros', active: false, missing: !m }
  }
  return { kind: 'empty', name: 'Empty', icon: 'empty-slot', active: false, missing: false }
}

export function createMockApi(params: URLSearchParams = new URLSearchParams()): KreoApi {
  let settings = defaultSettings()
  if (!params.has('first-run')) settings.general.firstRunDone = true
  const count = Math.min(8, Math.max(4, Number(params.get('n')) || 8))
  settings.apps.forEach(a => { a.slots = a.slots.slice(0, count) })
  settings.mainDial.slots.forEach(s => { if (s.type === 'folder') s.items = s.items.slice(0, count) })
  if (params.has('paused')) settings.enabled = false
  const missing = (params.get('missing') ?? '').split(',').filter(Boolean)
  if (params.has('demo-macros')) {
    settings.macros = [
      { id: 'm-export', name: 'Export for web', icon: 'macros', steps: [
        { type: 'keys', keys: ['Ctrl', 'Shift', 'Alt', 'W'] }, { type: 'wait', ms: 500 },
        { type: 'text', text: 'web-export' }, { type: 'keys', keys: ['Enter'] }] },
      { id: 'm-sig', name: 'Email signature', icon: 'macros', steps: [{ type: 'text', text: 'Best regards' }] },
      { id: 'm-open', name: 'Open project folder', icon: 'macros', steps: [
        { type: 'open', target: 'C:\Projects' }, { type: 'wait', ms: 1000 }] }
    ]
    const folder = settings.mainDial.slots[7]
    if (folder.type === 'folder') folder.items = [{ type: 'macro', macroId: 'm-export' }, { type: 'macro', macroId: 'm-sig' }, { type: 'macro', macroId: 'm-open' }, null, null, null, null, null]
  }

  const settingsCbs = new Set<(s: Settings) => void>()
  const statusCbs = new Set<(s: AppStatus) => void>()
  const gestureCbs = new Set<(g: Gesture) => void>()

  const status = (): AppStatus => ({
    enabled: settings.enabled,
    hook: 'ok',
    hookKind: 'native',
    active: { label: 'Volume', icon: 'volume' },
    appAvailability: Object.fromEntries(missing.map((id) => [id, false])),
    macroRunning: null
  })
  const view = (): DialView => {
    const s = settings.mainDial
    const slots = s.slots.map((x, i): DialSlotView => x.type === 'system' ? {kind:'system', name:SYSTEM_META[x.control].name, icon:SYSTEM_META[x.control].icon, active:i === 0, missing:false} : customSlotView(x, settings))
    return { open: false, level: 'main', levelLabel: null, slots, highlight: 0, hint: null, chosenTick: 0 }
  }
  const push = (): void => {
    for (const cb of settingsCbs) cb(structuredClone(settings))
    for (const cb of statusCbs) cb(status())
  }

  if (params.has('test-demo')) {
    let i = 0
    window.setTimeout(function tick() {
      const g = DEMO[i++ % DEMO.length]
      for (const cb of gestureCbs) cb(g)
      window.setTimeout(tick, 700)
    }, 250)
  }

  const reading: Readout = params.has('warning') ? { kind: 'warning', icon: 'warning', label: params.get('warning') || 'DaVinci Resolve not found', value: null, percent: null } : { kind: 'value', icon: 'volume', label: 'Volume', value: '45%', percent: 45 }

  return {
    windowKind: 'dashboard',
    getSettings: async () => structuredClone(settings),
    setSettings: async (next) => {
      settings = structuredClone(next)
      push()
    },
    onSettings: (cb) => {
      settingsCbs.add(cb)
      return () => settingsCbs.delete(cb)
    },
    resetSettings: async () => {
      settings = defaultSettings()
      push()
      return structuredClone(settings)
    },
    exportSettings: async () => true,
    importSettings: async () => true,
    getStatus: async () => status(),
    onStatus: (cb) => {
      statusCbs.add(cb)
      return () => statusCbs.delete(cb)
    },
    getDialView: async () => view(),
    onDialView: () => () => {},
    onReadout: (cb) => {
      const t = window.setTimeout(() => cb(reading), 50)
      return () => window.clearTimeout(t)
    },
    onGesture: (cb) => {
      gestureCbs.add(cb)
      return () => gestureCbs.delete(cb)
    },
    setTestMode: () => {},
    onDj: () => () => {},
    touchDj: () => {},
    releaseDj: async () => {},
    pickApp: async () => null,
    getAppIcon: async () => null,
    listInstalledApps: async () => [
      { name: 'Adobe Photoshop 2026', exePath: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe', processName: 'Photoshop.exe' },
      { name: 'Blender 5.3', exePath: 'C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender-launcher.exe', processName: 'blender-launcher.exe' },
      { name: 'DaVinci Resolve', exePath: 'C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\Resolve.exe', processName: 'Resolve.exe' },
      { name: 'Notepad++', exePath: 'C:\\Program Files\\Notepad++\\notepad++.exe', processName: 'notepad++.exe' },
      { name: 'Spotify', exePath: 'C:\\Users\\Me\\AppData\\Roaming\\Spotify\\Spotify.exe', processName: 'Spotify.exe' }
    ],
    runMacro: async () => {},
    stopMacro: async () => {},
    minimizeWindow: () => console.info('[mock] minimize'),
    closeWindow: () => console.info('[mock] close')
  }
}
