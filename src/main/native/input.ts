import koffi from 'koffi'
import { KEY_VK, EXTENDED_KEYS, normalizeKeys, MODIFIERS } from '../../shared/keys'
import type { Stroke } from '../../shared/types'

export type Input = { type: 'key'; vk: number; up: boolean; extended: boolean; unicode?: boolean } | { type: 'wheel'; horizontal: boolean; delta: number }

export function strokeInputs(stroke: Stroke, repeat = 1): Input[] {
  if (!Number.isInteger(repeat) || repeat < 0 || repeat > 10000) throw new Error('Invalid stroke repeat')
  const keys = normalizeKeys(stroke.type === 'keys' ? stroke.keys : stroke.mods)
  if (keys.some(key => !Object.hasOwn(KEY_VK, key))) throw new Error('Unknown key')
  if (stroke.type === 'wheel' && keys.some(key => !MODIFIERS.includes(key))) throw new Error('Wheel modifiers must be modifiers')
  const keyInput = (key: string, up: boolean): Input => ({ type: 'key', vk: KEY_VK[key], up, extended: EXTENDED_KEYS.has(key) })
  const result: Input[] = []
  for (let i = 0; i < repeat; i++) {
    result.push(...keys.map(key => keyInput(key, false)))
    if (stroke.type === 'wheel') result.push({ type: 'wheel', horizontal: ['left', 'right'].includes(stroke.dir), delta: ['down', 'left'].includes(stroke.dir) ? -120 : 120 })
    result.push(...[...keys].reverse().map(key => keyInput(key, true)))
  }
  return result
}

/** One key going down or up, for keys that stay held between strokes. */
export function keyInputs(key: string, up: boolean): Input[] {
  if (!Object.hasOwn(KEY_VK, key)) throw new Error('Unknown key')
  return [{ type: 'key', vk: KEY_VK[key], up, extended: EXTENDED_KEYS.has(key) }]
}

export function textInputs(text: string): Input[] {
  const result: Input[] = []
  // Send UTF-16 code units, including both halves of surrogate pairs.
  for (const unit of text.replace(/\r\n?/g, '\n').split('')) {
    const enter = unit === '\n'
    const vk = enter ? 13 : unit.charCodeAt(0)
    result.push({ type: 'key', vk, up: false, extended: false, unicode: !enter }, { type: 'key', vk, up: true, extended: false, unicode: !enter })
  }
  return result
}

/**
 * Written into dwExtraInfo of every key / wheel event Kreo Dial sends ('KREO'). The knob hook
 * ignores events carrying it, so the app never catches its own keys. Knob keys can't be told
 * apart by the injected flag: Kreo's keyboard software injects them itself (scan 0, flags 0x11).
 */
export const KREO_INPUT_TAG = 0x4b52454f

/** `tag` 0 = untagged, only for tests that imitate the knob. */
export function createInputSender(tag = KREO_INPUT_TAG): (inputs: Input[]) => void {
  const u = koffi.load('user32.dll')
  const send = u.func('uint32_t __stdcall SendInput(uint32_t, void *, int)')
  const map = u.func('uint32_t __stdcall MapVirtualKeyW(uint32_t, uint32_t)')
  const size = process.arch === 'ia32' ? 28 : 40, offset = size === 40 ? 8 : 4
  // dwExtraInfo offset inside KEYBDINPUT / MOUSEINPUT (pointer-sized, so it moves with alignment).
  const keyExtra = size === 40 ? 16 : 12, wheelExtra = size === 40 ? 24 : 20
  return (inputs) => {
    if (!inputs.length) return
    const buffer = Buffer.alloc(inputs.length * size)
    inputs.forEach((input, i) => {
      const base = i * size, p = base + offset
      buffer.writeUInt32LE(input.type === 'key' ? 1 : 0, base)
      if (input.type === 'key') {
        const scan = input.unicode ? input.vk : input.vk >= 0xad && input.vk <= 0xb3 ? 0 : map(input.vk, 0)
        // Keep the requested VK independent of NumLock and the foreground layout.
        buffer.writeUInt16LE(input.unicode ? 0 : input.vk, p)
        buffer.writeUInt16LE(scan & 0xffff, p + 2)
        buffer.writeUInt32LE((input.up ? 2 : 0) | (input.unicode ? 4 : 0) | (input.extended ? 1 : 0), p + 4)
        buffer.writeUInt32LE(tag, p + keyExtra)
      } else {
        buffer.writeInt32LE(input.delta, p + 8)
        buffer.writeUInt32LE(input.horizontal ? 0x1000 : 0x800, p + 12)
        buffer.writeUInt32LE(tag, p + wheelExtra)
      }
    })
    const sent = send(inputs.length, buffer, size)
    if (sent !== inputs.length) {
      // Release any modifiers left down by a partial SendInput (e.g. UIPI).
      const releases = inputs.filter((v): v is Extract<Input, { type: 'key' }> => v.type === 'key' && v.up)
      if (sent && releases.length) {
        const cleanup = Buffer.alloc(releases.length * size)
        releases.forEach((v, i) => {
          const p = i * size + offset
          cleanup.writeUInt32LE(1, i * size)
          cleanup.writeUInt16LE(v.unicode ? 0 : v.vk, p)
          if (v.unicode) cleanup.writeUInt16LE(v.vk, p + 2)
          cleanup.writeUInt32LE(2 | (v.unicode ? 4 : 0) | (v.extended ? 1 : 0), p + 4)
          cleanup.writeUInt32LE(tag, p + keyExtra)
        })
        send(releases.length, cleanup, size)
      }
      throw new Error(`SendInput sent ${sent}/${inputs.length} events (check foreground app elevation)`)
    }
  }
}
