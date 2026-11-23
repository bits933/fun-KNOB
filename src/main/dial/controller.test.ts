import { describe, expect, it } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import type { DialEffect, Gesture, Settings } from '@shared/types'
import { createDialController } from './controller'

const EXPORT = { id: 'export', name: 'Export', icon: 'macros', steps: [] }

/** Default settings plus one macro "Export" in the Macros folder. */
function settings(mut?: (s: Settings) => void): Settings {
  const s = defaultSettings()
  s.macros = [EXPORT]
  const macros = s.mainDial.slots[7]
  if (macros.type === 'folder') macros.items[0] = { type: 'macro', macroId: 'export' }
  mut?.(s)
  return s
}

function dial(mut?: (s: Settings) => void) {
  const d = createDialController(settings(mut), 0)
  let t = 0
  /** Run gestures 10 ms apart; returns all effects. */
  const g = (...gs: Gesture[]): DialEffect[] => gs.flatMap((x) => d.gesture(x, (t += 10)))
  const hl = () => d.view().slots[d.view().highlight].name
  const names = () => d.view().slots.map((s) => s.name)
  /** Rotate the open dial until `name` is highlighted. */
  const to = (name: string): DialEffect[] => {
    const fx: DialEffect[] = []
    for (let i = 0; i < 8 && hl() !== name; i++) fx.push(...g('rotate+'))
    expect(hl()).toBe(name)
    return fx
  }
  /** Open the Apps folder and double click Photoshop. */
  const photoshopDial = () => [...g('click'), ...to('Apps'), ...g('click'), ...to('Photoshop'), ...g('double')]
  /** Choose Photoshop's first function (Brush size). */
  const chooseBrush = () => [...photoshopDial(), ...g('click')]
  return { d, g, hl, names, to, photoshopDial, chooseBrush, time: () => t }
}

/** Effects other than 'view'. */
const acts = (fx: DialEffect[]) => fx.filter((e) => e.type !== 'view')
const hasView = (fx: DialEffect[]) => fx.some((e) => e.type === 'view')
const readouts = (fx: DialEffect[]) => fx.flatMap((e) => (e.type === 'readout' ? [e.readout] : []))

describe('dial closed', () => {
  it('rotate drives the active system function', () => {
    const { g } = dial()
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'volume', dir: 1, step: 2 }])
    expect(g('rotate-')).toEqual([{ type: 'system', control: 'volume', dir: -1, step: 2 }])
  })

  it('click opens the main dial on the active function', () => {
    const { d, g, hl } = dial()
    const fx = g('click')
    expect(acts(fx)).toEqual([])
    expect(hasView(fx)).toBe(true)
    expect(d.view()).toMatchObject({ open: true, level: 'main', levelLabel: null, highlight: 0, hint: null })
    expect(hl()).toBe('Volume')
  })

  it('double click and long press follow the gesture settings', () => {
    expect(dial().g('double')).toEqual([{ type: 'play-pause' }])
    expect(dial().g('long')).toEqual([{ type: 'mute' }])
    expect(dial((s) => (s.gestures.closedDouble = 'next-track')).g('double')).toEqual([{ type: 'next-track' }])
    expect(dial((s) => (s.gestures.closedDouble = 'none')).g('double')).toEqual([])
    expect(dial((s) => (s.gestures.closedLong = 'none')).g('long')).toEqual([])
  })

  it('hold + rotate cycles system functions without opening the dial', () => {
    const { d, g } = dial()
    const fx = g('hold-rotate+')
    expect(d.active()).toEqual({ kind: 'system', slot: 1 })
    expect(d.view().open).toBe(false)
    expect(readouts(fx)).toEqual([{ kind: 'message', icon: 'brightness', label: 'Brightness', value: null, percent: null }])
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'brightness', dir: 1, step: 5 }])
    g('hold-rotate-', 'hold-rotate-')
    expect(d.active()).toEqual({ kind: 'system', slot: 5 }) // wrapped to Switch apps
  })

  it('hold + rotate cycles app functions, skipping empty slots', () => {
    const { d, g, chooseBrush } = dial((s) => (s.apps[2].slots[1] = null))
    chooseBrush()
    expect(readouts(g('hold-rotate+'))[0].label).toBe('Zoom')
    expect(d.active()).toEqual({ kind: 'app', appId: 'photoshop', slot: 2 })
    g('hold-rotate-', 'hold-rotate-')
    expect(d.active()).toEqual({ kind: 'app', appId: 'photoshop', slot: 7 })
  })

  it('hold + rotate does nothing when set to none', () => {
    const { d, g } = dial((s) => (s.gestures.holdRotate = 'none'))
    expect(g('hold-rotate+')).toEqual([])
    expect(d.active()).toEqual({ kind: 'system', slot: 0 })
  })

  it('pressing the knob while a macro runs stops it and keeps the dial closed', () => {
    const { d, g } = dial()
    d.setMacroRunning('export')
    expect(g('click')).toEqual([{ type: 'stop-macro' }])
    expect(g('double')).toEqual([{ type: 'stop-macro' }])
    expect(g('long')).toEqual([{ type: 'stop-macro' }])
    expect(d.view().open).toBe(false)
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'volume', dir: 1, step: 2 }])
  })

  it('pressing while a macro runs stops it with the dial open too, without choosing', () => {
    const { d, g } = dial()
    g('click')
    d.setMacroRunning('export') // started from the dashboard
    expect(g('click')).toEqual([{ type: 'stop-macro' }])
    expect(d.active()).toEqual({ kind: 'system', slot: 0 })
    expect(d.view().open).toBe(true)
  })

  it('rotating with the dial closed does not emit a view', () => {
    expect(hasView(dial().g('rotate+', 'rotate-'))).toBe(false)
  })
})

describe('dial open: moving the highlight', () => {
  it('rotate moves the highlight and wraps both ways', () => {
    const { g, hl } = dial()
    g('click', 'rotate+')
    expect(hl()).toBe('Brightness')
    g('rotate-', 'rotate-')
    expect(hl()).toBe('Macros')
    g('rotate+')
    expect(hl()).toBe('Volume')
  })

  it('skips empty slots in a folder', () => {
    const { g, hl } = dial()
    g('click', 'rotate-', 'rotate-', 'click') // Apps folder
    expect(hl()).toBe('DaVinci Resolve')
    g('rotate-')
    expect(hl()).toBe('Blender')
    g('rotate+')
    expect(hl()).toBe('DaVinci Resolve')
  })

  it('skips an empty custom slot on the main dial', () => {
    const { g, hl } = dial((s) => (s.mainDial.slots[7] = { type: 'empty' }))
    g('click', 'rotate-')
    expect(hl()).toBe('Apps')
  })

  it('stays put in a folder with nothing in it', () => {
    const { d, g } = dial((s) => {
      const f = s.mainDial.slots[7]
      if (f.type === 'folder') f.items = Array(8).fill(null)
    })
    g('click', 'rotate-', 'click')
    expect(d.view()).toMatchObject({ level: 'folder', levelLabel: 'Macros', highlight: 0 })
    g('rotate+')
    expect(d.view().highlight).toBe(0)
  })

  it('hold + rotate is ignored while open', () => {
    const { d, g } = dial()
    g('click')
    expect(g('hold-rotate+')).toEqual([])
    expect(d.view().highlight).toBe(0)
  })
})

describe('dial open: choosing', () => {
  it('click on a system slot makes it active and closes the dial', () => {
    const { d, g } = dial()
    g('click', 'rotate+', 'rotate+')
    const fx = g('click')
    expect(acts(fx)).toEqual([])
    expect(d.view()).toMatchObject({ open: false, chosenTick: 1 })
    expect(d.active()).toEqual({ kind: 'system', slot: 2 })
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'scroll', dir: 1, step: 3 }])
    g('click')
    expect(d.view().highlight).toBe(2) // reopens on the active function
    expect(d.view().slots[2].active).toBe(true)
  })

  it('click on a folder enters it', () => {
    const { d, g, names } = dial()
    g('click', 'rotate-', 'rotate-', 'click')
    expect(d.view()).toMatchObject({ open: true, level: 'folder', levelLabel: 'Apps', highlight: 0, chosenTick: 0 })
    expect(names()).toEqual(['DaVinci Resolve', 'Figma', 'Photoshop', 'Blender', '', '', '', ''])
  })

  it('app slots show no hint under the name', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'rotate-')
    expect(d.view().hint).toBeNull() // on the Apps folder
    g('click')
    expect(d.view().hint).toBeNull()
  })

  it('click on an app opens it and closes the dial', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'rotate-', 'click', 'rotate+')
    expect(acts(g('click'))).toEqual([{ type: 'open-app', appId: 'figma' }])
    expect(d.view()).toMatchObject({ open: false, level: 'main', chosenTick: 1 })
    expect(d.active()).toEqual({ kind: 'system', slot: 0 })
  })

  it('double click on an app opens its 8-slot dial', () => {
    const { d, names, photoshopDial } = dial()
    photoshopDial()
    expect(d.view()).toMatchObject({ level: 'app', levelLabel: 'Photoshop', highlight: 0, hint: null })
    expect(d.view().slots.every((s) => s.kind === 'shortcut')).toBe(true)
    expect(names()[0]).toBe('Brush size')
  })

  it('click on an app function makes it active and brings the app to the front', () => {
    const { d, chooseBrush } = dial()
    const fx = chooseBrush()
    expect(acts(fx)).toEqual([{ type: 'open-app', appId: 'photoshop' }])
    expect(d.active()).toEqual({ kind: 'app', appId: 'photoshop', slot: 0 })
    expect(d.view()).toMatchObject({ open: false, chosenTick: 1 })
  })

  it('reopening an app dial highlights its active function; the main dial starts at the first slot', () => {
    const { d, g, hl, to, photoshopDial } = dial()
    photoshopDial()
    to('Zoom')
    g('click') // choose Zoom
    g('click') // reopen
    expect(d.view().highlight).toBe(0) // the app function is not on the main dial
    expect(d.view().slots.some((s) => s.active)).toBe(false)
    g('long') // close
    photoshopDial()
    expect(hl()).toBe('Zoom')
    expect(d.view().slots[2].active).toBe(true)
  })

  it('click on a macro runs it; choosing it again while running stops it', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'click')
    expect(acts(g('click'))).toEqual([{ type: 'run-macro', macroId: 'export' }])
    expect(d.view()).toMatchObject({ open: false, chosenTick: 1 })
    g('click', 'rotate-', 'click') // opened before the runner reported
    d.setMacroRunning('export')
    expect(acts(g('click'))).toEqual([{ type: 'stop-macro' }])
  })

  it('an app placed directly in a custom slot opens with click and shows its dial with double click', () => {
    const { d, g, hl } = dial((s) => (s.mainDial.slots[6] = { type: 'app', appId: 'blender' }))
    g('click', 'rotate-', 'rotate-')
    g('double')
    expect(d.view()).toMatchObject({ level: 'app', levelLabel: 'Blender' })
    g('long')
    expect(d.view().level).toBe('main')
    expect(hl()).toBe('Blender')
    expect(acts(g('click'))).toEqual([{ type: 'open-app', appId: 'blender' }])
  })
})

describe('dial open: back', () => {
  it('long press goes back one level each time and closes at the main level', () => {
    const { d, g, hl, photoshopDial } = dial()
    photoshopDial()
    g('long')
    expect(d.view()).toMatchObject({ level: 'folder', levelLabel: 'Apps' })
    expect(hl()).toBe('Photoshop')
    g('long')
    expect(d.view().level).toBe('main')
    expect(hl()).toBe('Apps')
    const fx = g('long')
    expect(acts(fx)).toEqual([])
    expect(d.view()).toMatchObject({ open: false, chosenTick: 0 })
  })

  it('long press on an app slot goes back instead of opening its dial', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'rotate-', 'click', 'long')
    expect(d.view().level).toBe('main')
  })

  it('double click goes back everywhere except on an app slot', () => {
    const { d, g, hl, to, photoshopDial } = dial()
    photoshopDial()
    g('double') // on a shortcut slot → back
    expect(d.view().level).toBe('folder')
    expect(hl()).toBe('Photoshop')
    g('long')
    to('Macros')
    g('click')
    expect(hl()).toBe('Export')
    g('double') // on a macro → back
    expect(d.view().level).toBe('main')
    expect(hl()).toBe('Macros')
    g('double') // on a folder at main → closes
    expect(d.view().open).toBe(false)
  })
})

describe('auto-close', () => {
  it('closes after autoCloseMs without input', () => {
    const { d, g, time } = dial()
    expect(d.nextDeadline()).toBeNull()
    g('click')
    const opened = time()
    expect(d.nextDeadline()).toBe(opened + 4000)
    g('rotate+')
    expect(d.nextDeadline()).toBe(time() + 4000)
    expect(d.tick(time() + 3999)).toEqual([])
    const fx = d.tick(time() + 4000)
    expect(hasView(fx)).toBe(true)
    expect(d.view()).toMatchObject({ open: false, level: 'main', chosenTick: 0 })
    expect(d.nextDeadline()).toBeNull()
  })

  it('uses the configured time', () => {
    const { d, g, time } = dial((s) => (s.general.autoCloseMs = 1000))
    g('click')
    expect(d.nextDeadline()).toBe(time() + 1000)
  })
})

describe('app function and the app in front', () => {
  it('sends the shortcut while the app is in front (process name case-insensitive)', () => {
    const { d, g, chooseBrush } = dial()
    chooseBrush()
    d.setForeground('PHOTOSHOP.exe', 0)
    expect(g('rotate+')).toEqual([
      { type: 'stroke', appId: 'photoshop', stroke: { type: 'keys', keys: [']'] }, dir: 1, label: 'Brush size', icon: 'brush' }
    ])
    expect(g('rotate-')).toEqual([
      { type: 'stroke', appId: 'photoshop', stroke: { type: 'keys', keys: ['['] }, dir: -1, label: 'Brush size', icon: 'brush' }
    ])
  })

  it('falls back to the last system function, with the readout once per episode', () => {
    const { d, g, chooseBrush } = dial()
    g('click', 'rotate+', 'rotate+', 'click') // Scroll
    chooseBrush()
    d.setForeground('chrome.exe', 0)
    const first = g('rotate+')
    expect(first[0]).toEqual({ type: 'system', control: 'scroll', dir: 1, step: 3 })
    expect(readouts(first)).toEqual([
      { kind: 'message', icon: 'scroll', label: 'Photoshop not in front: Scroll', value: null, percent: null }
    ])
    expect(g('rotate+', 'rotate-')).toEqual([
      { type: 'system', control: 'scroll', dir: 1, step: 3 },
      { type: 'system', control: 'scroll', dir: -1, step: 3 }
    ])
    d.setForeground('explorer.exe', 0) // still the same episode
    expect(readouts(g('rotate+'))).toEqual([])

    d.setForeground('Photoshop.exe', 0)
    expect(g('rotate+')[0].type).toBe('stroke')
    expect(d.active()).toEqual({ kind: 'app', appId: 'photoshop', slot: 0 })

    d.setForeground('chrome.exe', 0) // new episode
    expect(readouts(g('rotate+'))).toHaveLength(1)
  })

  it('treats an unknown foreground as not in front', () => {
    const { d, g, chooseBrush } = dial()
    chooseBrush()
    d.setForeground(null, 0)
    expect(g('rotate+')[0]).toEqual({ type: 'system', control: 'volume', dir: 1, step: 2 })
  })

  it('an app slot without a stroke for that direction does nothing', () => {
    const { d, g, chooseBrush } = dial((s) => (s.apps[2].slots[0]!.right = null))
    chooseBrush()
    d.setForeground('Photoshop.exe', 0)
    expect(g('rotate+')).toEqual([])
  })
})

describe('missing apps', () => {
  it('marks missing apps and warns instead of opening them', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'rotate-', 'click')
    expect(hasView(d.setAppAvailability({ resolve: true, photoshop: false }))).toBe(true)
    expect(d.view().slots.map((s) => s.missing)).toEqual([false, false, true, false, false, false, false, false])
    expect(d.setAppAvailability({ resolve: true, photoshop: false })).toEqual([]) // no change, no view
    g('rotate+', 'rotate+')
    const fx = g('click')
    expect(fx.some((e) => e.type === 'open-app')).toBe(false)
    expect(readouts(fx)).toEqual([
      { kind: 'warning', icon: 'warning', label: 'Photoshop not found', value: 'Locate app', percent: null }
    ])
    expect(d.view()).toMatchObject({ open: false, chosenTick: 0 })
  })

  it("a missing app's dial still opens; choosing a function warns instead of opening", () => {
    const { d, chooseBrush } = dial()
    d.setAppAvailability({ photoshop: false })
    const fx = chooseBrush()
    expect(fx.some((e) => e.type === 'open-app')).toBe(false)
    expect(readouts(fx)[0].kind).toBe('warning')
    expect(d.active()).toEqual({ kind: 'app', appId: 'photoshop', slot: 0 })
  })
})

describe('app icons', () => {
  it('app slots carry their exePath (main dial and folders), only when set', () => {
    const exe = 'C:/PS/Photoshop.exe'
    const { d, g, to } = dial((s) => {
      s.apps.find((a) => a.id === 'photoshop')!.exePath = exe
      s.mainDial.slots[7] = { type: 'app', appId: 'photoshop' }
    })
    g('click')
    expect(d.view().slots[7]).toMatchObject({ kind: 'app', name: 'Photoshop', exePath: exe })
    expect(d.view().slots[0].exePath).toBeUndefined()
    to('Apps'); g('click')
    const byName = Object.fromEntries(d.view().slots.map((s) => [s.name, s.exePath]))
    expect(byName.Photoshop).toBe(exe)
    expect('exePath' in d.view().slots[0]).toBe(false) // Resolve: exePath ''
  })
})

describe('settings changes', () => {
  it('an active app function that disappears falls back to the last system function', () => {
    const { d, g, chooseBrush } = dial()
    g('hold-rotate+') // Brightness
    chooseBrush()
    d.setSettings(settings((s) => (s.apps = s.apps.filter((a) => a.id !== 'photoshop'))), 0)
    expect(d.active()).toEqual({ kind: 'system', slot: 1 })
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'brightness', dir: 1, step: 5 }])
  })

  it('an active shortcut slot that is emptied falls back too', () => {
    const { d, chooseBrush } = dial()
    chooseBrush()
    d.setSettings(settings((s) => (s.apps[2].slots[0] = null)), 0)
    expect(d.active()).toEqual({ kind: 'system', slot: 0 })
  })

  it('leaves an app dial whose app was removed', () => {
    const { d, photoshopDial } = dial()
    photoshopDial()
    const fx = d.setSettings(settings((s) => (s.apps = s.apps.filter((a) => a.id !== 'photoshop'))), 0)
    expect(hasView(fx)).toBe(true)
    expect(d.view()).toMatchObject({ open: true, level: 'folder', levelLabel: 'Apps' })
    expect(d.view().slots[d.view().highlight].kind).not.toBe('empty')
  })

  it('leaves a folder that was replaced', () => {
    const { d, g } = dial()
    g('click', 'rotate-', 'rotate-', 'click', 'rotate-') // Blender in Apps
    d.setSettings(settings((s) => (s.mainDial.slots[6] = { type: 'empty' })), 0)
    expect(d.view()).toMatchObject({ open: true, level: 'main', levelLabel: null })
    expect(d.view().slots[6].kind).toBe('empty')
    g('rotate+', 'rotate+', 'rotate+', 'rotate+', 'rotate+', 'rotate+', 'rotate+')
    expect(d.view().slots[d.view().highlight].kind).not.toBe('empty')
  })

  it('a system control swap shows in the view and drives rotation', () => {
    const { d, g } = dial()
    d.setSettings(settings((s) => (s.mainDial.slots[0] = { type: 'system', control: 'mic', step: 4 })), 0)
    expect(d.view().slots[0]).toEqual({ kind: 'system', name: 'Mic volume', icon: 'mic', active: true, missing: false })
    expect(g('rotate+')).toEqual([{ type: 'system', control: 'mic', dir: 1, step: 4 }])
  })

  it('a removed macro becomes an empty place', () => {
    const { d, g } = dial()
    d.setSettings(settings((s) => (s.macros = [])), 0)
    g('click', 'rotate-', 'click')
    expect(d.view().slots[0]).toEqual({ kind: 'empty', name: '', icon: 'empty-slot', active: false, missing: false })
  })

  it('pausing closes an open dial', () => {
    const { d, g } = dial()
    g('click')
    const fx = d.setSettings(settings((s) => (s.enabled = false)), 0)
    expect(hasView(fx)).toBe(true)
    expect(d.view().open).toBe(false)
  })
})

describe('paused', () => {
  it('returns no effects for any gesture and keeps its state', () => {
    const { d, g } = dial((s) => (s.enabled = false))
    const all: Gesture[] = ['rotate+', 'rotate-', 'click', 'double', 'long', 'hold-rotate+', 'hold-rotate-']
    expect(g(...all)).toEqual([])
    expect(d.view().open).toBe(false)
    expect(d.active()).toEqual({ kind: 'system', slot: 0 })
  })
})

describe('view', () => {
  it('main dial: 8 slots with names and icons from the settings', () => {
    const v = dial().d.view()
    expect(v.slots).toHaveLength(8)
    expect(v.slots.map((s) => [s.kind, s.name, s.icon])).toEqual([
      ['system', 'Volume', 'volume'],
      ['system', 'Brightness', 'brightness'],
      ['system', 'Scroll', 'scroll'],
      ['system', 'Zoom', 'zoom'],
      ['system', 'Media', 'media'],
      ['system', 'Switch apps', 'switch-apps'],
      ['folder', 'Apps', 'apps-folder'],
      ['folder', 'Macros', 'macros']
    ])
    expect(v.slots.filter((s) => s.active).map((s) => s.name)).toEqual(['Volume'])
    expect(v).toMatchObject({ open: false, level: 'main', levelLabel: null, hint: null, chosenTick: 0 })
  })

  it('app dial preserves four shortcut places', () => {
    const { d, photoshopDial } = dial((s) => (s.apps[2].slots = s.apps[2].slots.slice(0, 4)))
    photoshopDial()
    expect(d.view().slots).toHaveLength(4)
    expect(d.view().slots[3].kind).toBe('shortcut')
  })
})


describe('default option auto-return', () => {
  const RET = 20_000
  /** Switch to Scroll (slot 2) via the open dial. */
  const toScroll = (t: ReturnType<typeof dial>) => t.g('click', 'rotate+', 'rotate+', 'click')

  it('starts on the configured default control', () => {
    const { d } = dial((s) => (s.general.defaultControl = 'brightness'))
    expect(d.active()).toEqual({ kind: 'system', slot: 1 })
    expect(d.nextDeadline()).toBeNull()
  })

  it('returns to the default after 20 s of inactivity from a system control', () => {
    const t = dial()
    toScroll(t)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 2 })
    expect(t.d.nextDeadline()).toBe(t.time() + RET)
    t.g('rotate+')
    expect(t.d.nextDeadline()).toBe(t.time() + RET) // rotating resets the deadline
    expect(t.d.tick(t.time() + RET - 1)).toEqual([])
    expect(t.d.active()).toEqual({ kind: 'system', slot: 2 })
    const fx = t.d.tick(t.time() + RET)
    expect(hasView(fx)).toBe(true)
    expect(fx[0]).toEqual({ type: 'view', view: t.d.view() })
    expect(t.d.active()).toEqual({ kind: 'system', slot: 0 })
    expect(t.d.nextDeadline()).toBeNull()
  })

  it('returns from an app shortcut and resets the fallback readout', () => {
    const t = dial()
    t.chooseBrush()
    t.d.setForeground('chrome.exe', 0)
    expect(readouts(t.g('rotate+'))).toHaveLength(1)
    expect(t.d.nextDeadline()).toBe(t.time() + RET)
    t.d.tick(t.time() + RET)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 0 })
    expect(t.g('rotate+')).toEqual([{ type: 'system', control: 'volume', dir: 1, step: 2 }])
    // a new app choice shows the "not in front" readout again
    t.chooseBrush()
    expect(readouts(t.g('rotate+'))).toHaveLength(1)
  })

  it('does not return while the dial is open (auto-close applies instead)', () => {
    const t = dial()
    toScroll(t)
    t.g('click')
    expect(t.d.nextDeadline()).toBe(t.time() + 4000)
    t.d.tick(t.time() + 4000) // closes, still Scroll
    expect(t.d.active()).toEqual({ kind: 'system', slot: 2 })
    expect(t.d.nextDeadline()).toBe(t.time() + RET)
  })

  it('follows the default control to another slot index', () => {
    const t = dial((s) => {
      const [a, b] = [s.mainDial.slots[0], s.mainDial.slots[3]]
      s.mainDial.slots[0] = b
      s.mainDial.slots[3] = a
    })
    expect(t.d.active()).toEqual({ kind: 'system', slot: 3 }) // Volume moved to slot 3
    t.g('hold-rotate+')
    expect(t.d.nextDeadline()).toBe(t.time() + RET)
    t.d.tick(t.time() + RET)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 3 })
  })

  it('uses the configured return time', () => {
    const t = dial((s) => (s.general.defaultReturnMs = 5000))
    t.g('hold-rotate+')
    expect(t.d.nextDeadline()).toBe(t.time() + 5000)
  })

  it('defaultControl: null disables auto-return', () => {
    const t = dial((s) => (s.general.defaultControl = null))
    expect(t.d.active()).toEqual({ kind: 'system', slot: 0 })
    t.g('hold-rotate+')
    expect(t.d.nextDeadline()).toBeNull()
    t.d.tick(t.time() + 10 * RET)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 1 })
  })

  it('no return when paused or when the default control is not on the dial', () => {
    const t = dial((s) => (s.general.defaultControl = 'mic'))
    expect(t.d.active()).toEqual({ kind: 'system', slot: 0 })
    t.g('hold-rotate+')
    expect(t.d.nextDeadline()).toBeNull()
    const p = dial()
    p.g('hold-rotate+')
    p.d.setSettings(settings((s) => (s.enabled = false)), p.time())
    expect(p.d.nextDeadline()).toBeNull()
  })

  it('changing defaultControl in settings switches to it immediately', () => {
    const t = dial()
    const fx = t.d.setSettings(settings((s) => (s.general.defaultControl = 'zoom')), 500)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 3 })
    expect(hasView(fx)).toBe(true)
    expect(t.g('rotate+')).toEqual([{ type: 'system', control: 'zoom', dir: 1, step: 1 }])
    // switching to null keeps the current function
    t.d.setSettings(settings((s) => (s.general.defaultControl = null)), 600)
    expect(t.d.active()).toEqual({ kind: 'system', slot: 3 })
  })
})

it('click always opens the main dial; long press mutes', () => {
  const dial = createDialController(defaultSettings(), 0)
  dial.gesture('rotate+', 100)
  expect(dial.gesture('long', 200)).toEqual([{ type: 'mute' }])
  dial.gesture('click', 300)
  expect(dial.view().open).toBe(true)
})


it('opens straight to the in-front app knob shortcuts; back reaches the main dial', () => {
  const { d, g } = dial()
  d.setForeground('Photoshop.exe', 0)
  g('click')
  expect(d.view()).toMatchObject({ open: true, level: 'app', levelLabel: 'Photoshop' })
  expect(d.view().slots.every((x) => x.kind === 'shortcut' || x.kind === 'empty')).toBe(true)
  g('long')
  expect(d.view()).toMatchObject({ open: true, level: 'main', levelLabel: null })
})

it('opens the main dial when the app in front is not on the knob', () => {
  const { d, g } = dial()
  d.setForeground('notepad.exe', 0)
  g('click')
  expect(d.view()).toMatchObject({ open: true, level: 'main' })
})


for (const n of [4, 5]) it(`wraps a ${n}-slot main ring`, () => {
  const {d, g} = dial(s => { s.mainDial.slots = s.mainDial.slots.slice(0, n) })
  g('click', 'rotate-'); expect(d.view().highlight).toBe(n - 1)
  g('rotate+'); expect(d.view().highlight).toBe(0)
  expect(d.view().slots).toHaveLength(n)
})
it('falls back to Volume with no system options; long press mutes', () => {
  const {d, g} = dial(s => { s.mainDial.slots = Array.from({length:4}, () => ({type:'empty'})) })
  expect(g('hold-rotate+')).toEqual([])
  expect(g('rotate+')).toEqual([{type:'system', control:'volume', dir:1, step:2}])
  expect(g('long')).toEqual([{type:'mute'}]); expect(d.view().open).toBe(false)
})
it('cycles system options at arbitrary main indices', () => {
  const {d, g} = dial(s => { s.mainDial.slots = [{type:'empty'}, {type:'system', control:'zoom', step:1}, {type:'empty'}, {type:'system', control:'scroll', step:3}] })
  g('hold-rotate+'); expect(d.active()).toEqual({kind:'system', slot:3})
  g('hold-rotate+'); expect(d.active()).toEqual({kind:'system', slot:1})
})
