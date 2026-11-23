/**
 * Factory settings (PRD §4, §5, §8).
 * Owner: orchestrator.
 */
import type { AppDef, KeyName, Settings, ShortcutSlot, Stroke, SystemControl } from './types'

const k = (...keys: KeyName[]): Stroke => ({ type: 'keys', keys })
const wheel = (dir: 'up' | 'down', ...mods: KeyName[]): Stroke => ({ type: 'wheel', dir, mods })
const slot = (name: string, icon: string, left: Stroke, right: Stroke): ShortcutSlot => ({
  name, icon, left, right, click: null
})
const undoRedo = slot('Undo / Redo', 'undo-redo', k('Ctrl', 'Z'), k('Ctrl', 'Shift', 'Z'))

/** How long the volume / brightness / mic level ring stays after the last knob input. A click while the volume ring is up mutes. */
export const LEVEL_RING_MS = 5000

/** Default step per knob click for each system control. */
export const SYSTEM_STEP: Record<SystemControl, number> = {
  volume: 2,
  brightness: 5,
  scroll: 3,
  zoom: 1,
  media: 1,
  dj: 1,
  'switch-apps': 1,
  'undo-redo': 1,
  'virtual-desktops': 1,
  mic: 2
}

export const SYSTEM_META: Record<SystemControl, { name: string; icon: string }> = {
  volume: { name: 'Volume', icon: 'volume' },
  brightness: { name: 'Brightness', icon: 'brightness' },
  scroll: { name: 'Scroll', icon: 'scroll' },
  zoom: { name: 'Zoom', icon: 'zoom' },
  media: { name: 'Media', icon: 'media' },
  dj: { name: 'DJ', icon: 'dj' },
  'switch-apps': { name: 'Switch apps', icon: 'switch-apps' },
  'undo-redo': { name: 'Undo / Redo', icon: 'undo-redo' },
  'virtual-desktops': { name: 'Virtual desktops', icon: 'virtual-desktops' },
  mic: { name: 'Mic volume', icon: 'mic' }
}

/** What turning the knob left / right does for each system control (shown in the slot editor). */
export const SYSTEM_TURN: Record<SystemControl, [left: string, right: string]> = {
  volume: ['Volume down', 'Volume up'],
  brightness: ['Dimmer', 'Brighter'],
  scroll: ['Scroll up', 'Scroll down'],
  zoom: ['Zoom out', 'Zoom in'],
  media: ['Back', 'Forward'],
  dj: ['Scratch back', 'Scratch forward'],
  'switch-apps': ['Previous app', 'Next app'],
  'undo-redo': ['Undo', 'Redo'],
  'virtual-desktops': ['Previous desktop', 'Next desktop'],
  mic: ['Mic down', 'Mic up']
}

export const DEFAULT_APPS: AppDef[] = [
  {
    id: 'resolve', name: 'DaVinci Resolve', icon: 'app-video', exePath: '', processName: 'Resolve.exe',
    slots: [
      slot('Scrub by frame', 'scrub', k('Left'), k('Right')),
      slot('Jump 1 second', 'jump', k('Shift', 'Left'), k('Shift', 'Right')),
      slot('Timeline zoom', 'timeline-zoom', k('Ctrl', '-'), k('Ctrl', '=')),
      slot('Previous / next clip', 'clip', k('Up'), k('Down')),
      slot('Nudge clip', 'nudge', k(','), k('.')),
      slot('Previous / next marker', 'marker', k('Shift', 'Up'), k('Shift', 'Down')),
      slot('Clip audio level', 'audio', k('Ctrl', 'Alt', '-'), k('Ctrl', 'Alt', '=')),
      undoRedo
    ]
  },
  {
    id: 'figma', name: 'Figma', icon: 'app-design', exePath: '', processName: 'Figma.exe',
    slots: [
      slot('Zoom', 'zoom', k('Ctrl', '-'), k('Ctrl', '=')),
      slot('Previous / next frame', 'frame', k('Shift', 'N'), k('N')),
      slot('Layer order', 'layers', k('Ctrl', '['), k('Ctrl', ']')),
      slot('Previous / next layer', 'step', k('Shift', 'Tab'), k('Tab')),
      slot('Pages', 'pages', k('PageUp'), k('PageDown')),
      slot('Text size', 'text-size', k('Ctrl', 'Shift', ','), k('Ctrl', 'Shift', '.')),
      slot('Scroll sideways', 'scroll-sideways', wheel('up', 'Shift'), wheel('down', 'Shift')),
      undoRedo
    ]
  },
  {
    id: 'photoshop', name: 'Photoshop', icon: 'app-image', exePath: '', processName: 'Photoshop.exe',
    slots: [
      slot('Brush size', 'brush', k('['), k(']')),
      slot('Brush hardness', 'hardness', k('Shift', '['), k('Shift', ']')),
      slot('Zoom', 'zoom', k('Ctrl', '-'), k('Ctrl', '=')),
      slot('Layer up / down', 'layers', k('Alt', '['), k('Alt', ']')),
      slot('Document tabs', 'tabs', k('Ctrl', 'Shift', 'Tab'), k('Ctrl', 'Tab')),
      slot('Text size', 'text-size', k('Ctrl', 'Shift', ','), k('Ctrl', 'Shift', '.')),
      slot('Scroll sideways', 'scroll-sideways', wheel('up', 'Ctrl'), wheel('down', 'Ctrl')),
      undoRedo
    ]
  },
  {
    id: 'blender', name: 'Blender', icon: 'app-3d', exePath: '', processName: 'blender.exe',
    slots: [
      slot('Orbit left / right', 'orbit', k('Num4'), k('Num6')),
      slot('Orbit up / down', 'orbit', k('Num8'), k('Num2')),
      slot('Zoom view', 'zoom', wheel('down'), wheel('up')),
      slot('Roll view', 'roll', k('Shift', 'Num4'), k('Shift', 'Num6')),
      slot('Step frame', 'step', k('Left'), k('Right')),
      slot('Jump keyframe', 'keyframe', k('Down'), k('Up')),
      slot('Brush size', 'brush', k('['), k(']')),
      undoRedo
    ]
  }
]

export function defaultSettings(): Settings {
  const controls: SystemControl[] = ['volume', 'brightness', 'scroll', 'zoom', 'media', 'switch-apps']
  return {
    version: 2,
    enabled: true,
    mainDial: {
      slots: [
        ...controls.map((control) => ({ type: 'system' as const, control, step: SYSTEM_STEP[control] })),
        {
          type: 'folder', name: 'Apps', icon: 'apps-folder',
          items: [
            { type: 'app', appId: 'resolve' }, { type: 'app', appId: 'figma' },
            { type: 'app', appId: 'photoshop' }, { type: 'app', appId: 'blender' },
            null, null, null, null
          ]
        },
        { type: 'folder', name: 'Macros', icon: 'macros', items: [null, null, null, null] }
      ]
    },
    apps: structuredClone(DEFAULT_APPS),
    macros: [],
    gestures: {
      doubleClickMs: 300,
      longPressMs: 500,
      holdChainMs: 600,
      closedDouble: 'play-pause',
      closedLong: 'mute',
      holdRotate: 'cycle'
    },
    general: {
      startWithWindows: false,
      runAsAdmin: false,
      showReadout: true,
      dialSizePercent: 100,
      levelSizePercent: 100,
      levelPosition: 'center',
      autoCloseMs: 4000,
      opensOn: 'cursor-screen',
      defaultControl: 'volume',
      defaultReturnMs: 20_000,
      firstRunDone: false
    }
  }
}
