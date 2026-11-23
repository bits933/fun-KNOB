import { describe, expect, it } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import { mainDialView, padItems, removeRefs, resetMainDial, swapSlots, validDialPath, folderDialView, slotKindText, strokeConflict, usages } from './helpers'

describe('screen helpers', () => {
  it('resets all main dial slots and folders while preserving other settings', () => {
    const s = defaultSettings()
    s.enabled = false
    s.general.dialSizePercent = 80
    s.apps[0].name = 'Custom app'
    const folder = s.mainDial.slots[6]
    if (folder.type !== 'folder') throw Error('fixture')
    folder.name = 'Custom folder'
    folder.items.fill(null)
    s.mainDial.slots[0] = { type: 'empty' }
    s.mainDial.slots.pop()
    const before = structuredClone(s)
    resetMainDial(s)
    expect(s.mainDial).toEqual(defaultSettings().mainDial)
    expect({ ...s, mainDial: before.mainDial }).toEqual(before)
    expect(s.mainDial).not.toBe(before.mainDial)
  })
  it('finds where an app is used and removes it', () => {
    const s = defaultSettings()
    expect(usages(s, { appId: 'figma' })).toEqual(['Slot 7 (Apps folder)'])
    removeRefs(s, { appId: 'figma' })
    expect(usages(s, { appId: 'figma' })).toEqual([])
    const c = s.mainDial.slots[6]
    expect(c.type === 'folder' && c.items.filter(Boolean).length).toBe(3)
  })

  it('reports a macro placed directly in a slot', () => {
    const s = defaultSettings()
    s.mainDial.slots[7] = { type: 'macro', macroId: 'm1' }
    expect(usages(s, { macroId: 'm1' })).toEqual(['Slot 8'])
    removeRefs(s, { macroId: 'm1' })
    expect(s.mainDial.slots[7]).toEqual({ type: 'empty' })
  })

  it('describes slots and pads folder items', () => {
    const s = defaultSettings()
    expect(slotKindText(s, 0)).toBe('System')
    expect(slotKindText(s, 6)).toBe('Folder · 4 apps')
    expect(slotKindText(s, 7)).toBe('Folder · empty')
    const padded = padItems([null, { type: 'app', appId: 'a' }, null])
    expect(padded).toHaveLength(4)
    expect(padded[0]).toBeNull()
    expect(padded[1]).toEqual({ type: 'app', appId: 'a' })
  })

  it('detects a shortcut already used in the same app', () => {
    const app = defaultSettings().apps.find((a) => a.id === 'photoshop')!
    expect(strokeConflict(app, 1, ['['])).toBe('Already used by Brush size')
    expect(strokeConflict(app, 0, ['['])).toBeNull()
  })
})


describe('nested dial editing', () => {
  it('swaps slots including holes without mutating the original', () => {
    const slots = ['a', null, 'b']
    expect(swapSlots(slots, 0, 1)).toEqual([null, 'a', 'b'])
    expect(slots).toEqual(['a', null, 'b'])
    expect(swapSlots(slots, -1, 2)).toEqual(slots)
    expect(swapSlots(slots, 0, 8)).toEqual(slots)
    expect(swapSlots(slots, 1, 1)).toEqual(slots)
  })
  it('validates folder and app paths against current membership', () => {
    const s = defaultSettings()
    const path = { custom: 6, appId: 'photoshop', place: 2 }
    expect(validDialPath(s, path)).toBe(true)
    expect(validDialPath(s, { custom: null, appId: null, place: null })).toBe(true)
    const f = s.mainDial.slots[6]
    if (f.type !== 'folder') throw Error('fixture')
    f.items[2] = null
    expect(validDialPath(s, path)).toBe(false)
    s.mainDial.slots[6] = { type: 'empty' }
    expect(validDialPath(s, { ...path, appId: null })).toBe(false)
    s.mainDial.slots[7] = { type: 'app', appId: 'photoshop' }
    expect(validDialPath(s, { custom: null, appId: 'photoshop', place: 7 })).toBe(true)
    s.apps = s.apps.filter(a => a.id !== 'photoshop')
    expect(validDialPath(s, { custom: null, appId: 'photoshop', place: 7 })).toBe(false)
  })
  it('renders all eight folder places without compacting empty places', () => {
    const s = defaultSettings(), f = s.mainDial.slots[6]
    if (f.type !== 'folder') throw Error('fixture')
    f.items[1] = null
    const v = folderDialView(s, f)
    expect(v.slots).toHaveLength(8)
    expect(v.slots[1].kind).toBe('empty')
    expect(v.slots[2].name).toBe('Photoshop')
  })
  it('app slots carry exePath only when the app has one', () => {
    const s = defaultSettings(), f = s.mainDial.slots[6]
    if (f.type !== 'folder') throw Error('fixture')
    s.apps.find(a => a.id === 'photoshop')!.exePath = 'C:/PS/Photoshop.exe'
    const v = folderDialView(s, f)
    expect(v.slots[2].exePath).toBe('C:/PS/Photoshop.exe')
    expect('exePath' in v.slots[0]).toBe(false)
    s.mainDial.slots[7] = { type: 'app', appId: 'photoshop' }
    expect(mainDialView(s, 0).slots[7].exePath).toBe('C:/PS/Photoshop.exe')
  })
})
