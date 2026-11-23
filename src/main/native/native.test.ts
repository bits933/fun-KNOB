import { describe, expect, it } from 'vitest'
import { classifyKnob } from './hook'
import { strokeInputs, textInputs } from './input'
import { clampPercent } from './audio'
import { parseBrightnessLine } from './brightness'

describe('native pure logic', () => {
  it('deduplicates mute repeats until release and reports turns only on down', () => {
    let held = false
    const events: string[] = []
    for (const [vk, down] of [[0xad, true], [0xad, true], [0xaf, true], [0xaf, false], [0xad, false], [0xad, false], [0xad, true]] as const) {
      const result = classifyKnob(vk, down, held)
      held = result.held
      if (result.kind) events.push(result.kind)
    }
    expect(events).toEqual(['press', 'cw', 'release', 'press'])
  })
  it('holds modifiers around each extended key and releases in reverse order', () => {
    expect(strokeInputs({ type: 'keys', keys: ['Left', 'Shift', 'Ctrl'] }, 2)).toEqual(Array(2).fill([
      { type: 'key', vk: 17, up: false, extended: false },
      { type: 'key', vk: 16, up: false, extended: false },
      { type: 'key', vk: 37, up: false, extended: true },
      { type: 'key', vk: 37, up: true, extended: true },
      { type: 'key', vk: 16, up: true, extended: false },
      { type: 'key', vk: 17, up: true, extended: false }
    ]).flat())
  })
  it('builds horizontal and modified vertical wheels', () => {
    const seq = strokeInputs({ type: 'wheel', mods: ['Ctrl'], dir: 'down' })
    expect(seq.map(v => v.type)).toEqual(['key', 'wheel', 'key'])
    expect(seq[1]).toEqual({ type: 'wheel', horizontal: false, delta: -120 })
    expect(strokeInputs({ type: 'wheel', mods: [], dir: 'right' })).toEqual([{ type: 'wheel', horizontal: true, delta: 120 }])
  })
  it('preserves surrogate pairs and converts CRLF to one Enter', () => {
    const seq = textInputs('😀\r\nA')
    expect(seq.filter(v => v.type === 'key' && !v.up).map(v => v.type === 'key' && [v.vk, v.unicode])).toEqual([[0xd83d, true], [0xde00, true], [13, false], [65, true]])
  })
  it('rejects invalid input and clamps valid percentages', () => {
    expect(() => strokeInputs({ type: 'keys', keys: ['unknown'] })).toThrow()
    expect(() => strokeInputs({ type: 'keys', keys: [] }, Infinity)).toThrow()
    expect(() => clampPercent(NaN)).toThrow()
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(-10)).toBe(0)
  })
  it('parses only valid brightness protocol replies', () => {
    expect(parseBrightnessLine('12 value 45')).toEqual({ id: 12, value: 45 })
    expect(parseBrightnessLine('13 ok')).toEqual({ id: 13, value: true })
    expect(parseBrightnessLine('14 unsupported')).toEqual({ id: 14, value: null })
    expect(parseBrightnessLine('15 value 101')).toBeNull()
    expect(parseBrightnessLine('PowerShell error')).toBeNull()
  })
})
