/**
 * Data for the overlay: the real bridge (`window.kreo`) when present, otherwise mock data
 * picked by URL query so the page can be screenshotted and demoed.
 *   ?mock=main&h=0..7  ?mock=folder  ?mock=app  ?mock=missing  ?mock=paused  ?mock=closed
 *   ?realicon=1 gives the mock's app slots real .exe paths and ignores the bridge's dial data, so a capture script
 *   that injects `window.kreo = { getAppIcon }` can show real icons.
 *   ?mock=readout-value|readout-message|readout-warning   ?mock=level-volume|level-brightness|level-mic&p=0..100|level-muted   ?demo=1   ?size=60..140   ?levelsize=40..140   ?levelpos=top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right   ?bg=#444
 */
import { useEffect, useState } from 'react'
import type { DialSlotView, DialView, LevelPosition, Readout, Settings } from '@shared/types'

export interface OverlayData {
  view: DialView
  readout: Readout | null
  /** 0.6 – 1.4 */
  scale: number
  /** 0.4 – 1.4, the level ring only */
  levelScale: number
  levelPosition: LevelPosition
  paused: boolean
}

const slot = (name: string, icon: string, extra: Partial<DialSlotView> = {}): DialSlotView => ({
  kind: 'system', name, icon, active: false, missing: false, ...extra
})
const EMPTY = slot('', 'empty-slot', { kind: 'empty' })

const MAIN: DialSlotView[] = [
  slot('Volume', 'volume'),
  slot('Brightness', 'brightness', { active: true }),
  slot('Scroll', 'scroll'),
  slot('Zoom', 'zoom'),
  slot('Media', 'media'),
  slot('Switch apps', 'switch-apps'),
  slot('Apps', 'apps-folder', { kind: 'folder' }),
  slot('Macros', 'macros', { kind: 'folder' })
]
const FOLDER: DialSlotView[] = [
  slot('DaVinci Resolve', 'app-video', { kind: 'app' }),
  slot('Figma', 'app-design', { kind: 'app' }),
  slot('Photoshop', 'app-image', { kind: 'app' }),
  slot('Blender', 'app-3d', { kind: 'app' }),
  EMPTY, EMPTY, EMPTY, EMPTY
]
const PHOTOSHOP: DialSlotView[] = [
  ['Brush size', 'brush'], ['Brush hardness', 'hardness'], ['Zoom', 'zoom'], ['Layer up / down', 'layers'],
  ['Document tabs', 'tabs'], ['Text size', 'text-size'], ['Scroll sideways', 'scroll-sideways'],
  ['Undo / Redo', 'undo-redo']
].map(([n, i]) => slot(n, i, { kind: 'shortcut' }))

const view = (p: Partial<DialView> & Pick<DialView, 'slots'>): DialView => ({
  open: true, level: 'main', levelLabel: null, highlight: 0, hint: null, chosenTick: 0, ...p
})
const mainView = (h = 0): DialView => view({ slots: MAIN, highlight: h })
const folderView = (h = 0): DialView =>
  view({ level: 'folder', levelLabel: 'Apps', slots: FOLDER, highlight: h, hint: null })
const appView = (h = 0): DialView =>
  view({ level: 'app', levelLabel: 'Photoshop', slots: PHOTOSHOP, highlight: h })
const missingView = (h = 3): DialView =>
  view({
    level: 'folder', levelLabel: 'Apps', highlight: h, hint: null,
    slots: FOLDER.map((s, i) => (i === 3 ? { ...s, missing: true } : s))
  })

const READOUTS: Record<string, Readout> = {
  value: { kind: 'value', icon: 'volume', label: 'Volume', value: '45%', percent: 45 },
  message: { kind: 'message', icon: 'macros', label: 'Running', value: 'Export for web', percent: null },
  warning: { kind: 'warning', icon: 'warning', label: 'Photoshop not in front', value: 'Knob → Volume', percent: null }
}

function mockFromQuery(q: URLSearchParams): Pick<OverlayData, 'view' | 'readout' | 'paused'> {
  const mock = q.get('mock') ?? 'main'
  const d = mockView(q, mock)
  if (q.has('realicon')) d.view = { ...d.view, slots: d.view.slots.map((s, i) => (s.kind === 'app' ? { ...s, exePath: REAL_EXES[i % REAL_EXES.length] } : s)) }
  return d
}

const REAL_EXES = ['C:/Windows/explorer.exe', 'C:/Windows/System32/notepad.exe', 'C:/Windows/System32/Taskmgr.exe', 'C:/Windows/regedit.exe']

function mockView(q: URLSearchParams, mock: string): Pick<OverlayData, 'view' | 'readout' | 'paused'> {
  const h = Math.min(7, Math.max(0, Number(q.get('h') ?? 0) || 0))
  const closed = { ...mainView(), open: false }
  if (mock.startsWith('level-')) {
    const p = Math.min(100, Math.max(0, Number(q.get('p') ?? 50) || 0))
    const kind = mock.slice(6)
    const label = kind === 'brightness' ? 'Brightness' : kind === 'mic' || kind === 'muted' ? 'Mic' : 'Volume'
    const icon = kind === 'brightness' ? 'brightness' : kind === 'volume' ? 'volume' : 'mic'
    return {
      view: closed,
      readout: { kind: 'value', icon, label, value: kind === 'muted' ? 'Muted' : `${p}%`, percent: kind === 'muted' ? 0 : p },
      paused: false
    }
  }
  if (mock.startsWith('readout-')) return { view: closed, readout: READOUTS[mock.slice(8)] ?? null, paused: false }
  switch (mock) {
    case 'folder': return { view: folderView(h), readout: null, paused: false }
    case 'app': return { view: appView(h), readout: null, paused: false }
    case 'missing': return { view: missingView(h || 3), readout: null, paused: false }
    case 'paused': return { view: mainView(h), readout: null, paused: true }
    case 'closed': return { view: closed, readout: null, paused: false }
    default: return { view: mainView(h), readout: null, paused: false }
  }
}

/** A timed tour through highlights (incl. wrap-around and fast bursts), a folder, a pulse and readouts. */
function runDemo(set: (p: Partial<OverlayData>) => void): () => void {
  let tick = 0
  const steps: Array<[number, () => void]> = [
    [500, () => set({ view: mainView(0) })],
    [700, () => set({ view: mainView(1) })],
    [700, () => set({ view: mainView(2) })],
    [90, () => set({ view: mainView(3) })], // fast burst
    [90, () => set({ view: mainView(4) })],
    [90, () => set({ view: mainView(5) })],
    [800, () => set({ view: mainView(6) })],
    [800, () => set({ view: mainView(7) })],
    [800, () => set({ view: mainView(0) })], // 7 -> 0 moves forward
    [800, () => set({ view: mainView(7) })], // 0 -> 7 moves backward
    [800, () => set({ view: mainView(6) })],
    [700, () => set({ view: { ...mainView(6), chosenTick: ++tick } })], // pulse
    [500, () => set({ view: folderView(0) })], // enter folder
    [800, () => set({ view: folderView(1) })],
    [800, () => set({ view: folderView(2) })],
    [800, () => set({ view: missingView(3) })],
    [900, () => set({ view: appView(0) })], // enter app dial
    [800, () => set({ view: appView(1) })],
    [900, () => set({ view: folderView(2) })], // back
    [900, () => set({ view: mainView(6) })], // back again
    [700, () => set({ view: { ...mainView(6), open: false } })], // close
    [700, () => set({ readout: READOUTS.value })],
    [200, () => set({ readout: { ...READOUTS.value, value: '47%', percent: 47 } })],
    [200, () => set({ readout: { ...READOUTS.value, value: '49%', percent: 49 } })],
    [900, () => set({ readout: { ...READOUTS.value, label: 'Brightness', value: '30%', percent: 30 } })],
    [150, () => set({ readout: { ...READOUTS.value, label: 'Brightness', value: '55%', percent: 55 } })],
    [150, () => set({ readout: { ...READOUTS.value, label: 'Brightness', value: '100%', percent: 100 } })],
    [1400, () => set({ readout: { ...READOUTS.value, label: 'Mic', value: 'Muted', percent: 0 } })],
    [1500, () => set({ readout: READOUTS.message })],
    [1700, () => set({ readout: READOUTS.warning })],
    [1700, () => set({ readout: null })],
    [600, () => set({ view: mainView(0) })] // reopen
  ]
  let i = 0
  let timer: ReturnType<typeof setTimeout>
  const next = (): void => {
    const [wait, fn] = steps[i % steps.length]
    timer = setTimeout(() => {
      fn()
      i++
      next()
    }, wait)
  }
  next()
  return () => clearTimeout(timer)
}

export function useOverlayData(): OverlayData {
  const q = new URLSearchParams(location.search)
  const size = Number(q.get('size')) || 100
  const [data, setData] = useState<OverlayData>(() => ({
    ...(() => { const d = mockFromQuery(q); const n = Math.min(8, Math.max(4, Number(q.get('n')) || 8)); d.view.slots = d.view.slots.slice(0, n); d.view.highlight %= n; return d })(),
    scale: size / 100,
    levelScale: (Number(q.get('levelsize')) || 100) / 100,
    levelPosition: (q.get('levelpos') ?? 'center') as LevelPosition
  }))

  useEffect(() => {
    const merge = (p: Partial<OverlayData>): void => setData((d) => ({ ...d, ...p }))
    const api = q.has('realicon') ? undefined : window.kreo
    if (!api) return q.get('demo') ? runDemo(merge) : undefined
    // The window covers the work area: the dial size setting is clamped so the dial never exceeds the screen.
    let dialPct = 100
    const fit = (): void => merge({ scale: Math.min(dialPct / 100, window.innerWidth / 560, window.innerHeight / 640) })
    const apply = (s: Settings): void => {
      dialPct = s.general.dialSizePercent
      fit()
      merge({ paused: !s.enabled, levelScale: s.general.levelSizePercent / 100, levelPosition: s.general.levelPosition })
    }
    window.addEventListener('resize', fit)
    const offs = [
      api.onDialView((v) => merge({ view: v })),
      api.onReadout((r) => merge({ readout: r })),
      api.onSettings(apply),
      () => window.removeEventListener('resize', fit)
    ]
    void api.getDialView().then((v) => merge({ view: v }))
    void api.getSettings().then(apply)
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return data
}
