/**
 * Key names used in settings, and their Windows virtual-key codes.
 * Owner: orchestrator.
 */
import type { KeyName } from './types'

const range = (prefix: string, from: number, count: number, startVk: number): Record<string, number> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${from + i}`, startVk + i]))

const letters: Record<string, number> = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => [String.fromCharCode(65 + i), 0x41 + i])
)

export const KEY_VK: Record<KeyName, number> = {
  Ctrl: 0x11,
  Shift: 0x10,
  Alt: 0x12,
  Win: 0x5b,
  ...letters,
  ...range('', 0, 10, 0x30), // '0'–'9'
  ...range('F', 1, 24, 0x70), // F1–F24
  ...range('Num', 0, 10, 0x60), // Num0–Num9
  NumAdd: 0x6b,
  NumSub: 0x6d,
  NumMul: 0x6a,
  NumDiv: 0x6f,
  NumDec: 0x6e,
  Left: 0x25,
  Up: 0x26,
  Right: 0x27,
  Down: 0x28,
  Enter: 0x0d,
  Tab: 0x09,
  Space: 0x20,
  Esc: 0x1b,
  Backspace: 0x08,
  Delete: 0x2e,
  Insert: 0x2d,
  Home: 0x24,
  End: 0x23,
  PageUp: 0x21,
  PageDown: 0x22,
  '[': 0xdb,
  ']': 0xdd,
  ',': 0xbc,
  '.': 0xbe,
  '-': 0xbd,
  '=': 0xbb,
  ';': 0xba,
  "'": 0xde,
  '/': 0xbf,
  '\\': 0xdc,
  '`': 0xc0,
  MediaPlayPause: 0xb3,
  MediaNext: 0xb0,
  MediaPrev: 0xb1,
  MediaStop: 0xb2,
  VolumeUp: 0xaf,
  VolumeDown: 0xae,
  VolumeMute: 0xad
}

export const MODIFIERS: KeyName[] = ['Ctrl', 'Shift', 'Alt', 'Win']

/** Keys that need the "extended key" flag when sent. */
export const EXTENDED_KEYS = new Set<KeyName>([
  'Left', 'Up', 'Right', 'Down', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'NumDiv', 'Win',
  'MediaPlayPause', 'MediaNext', 'MediaPrev', 'MediaStop', 'VolumeUp', 'VolumeDown', 'VolumeMute'
])

const CODE_TO_KEY: Record<string, KeyName> = {
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Win', MetaRight: 'Win',
  ArrowLeft: 'Left', ArrowUp: 'Up', ArrowRight: 'Right', ArrowDown: 'Down',
  Enter: 'Enter', NumpadEnter: 'Enter', Tab: 'Tab', Space: 'Space', Escape: 'Esc',
  Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Minus: '-', Equal: '=',
  Semicolon: ';', Quote: "'", Slash: '/', Backslash: '\\', Backquote: '`',
  NumpadAdd: 'NumAdd', NumpadSubtract: 'NumSub', NumpadMultiply: 'NumMul',
  NumpadDivide: 'NumDiv', NumpadDecimal: 'NumDec'
}

/** Convert a browser KeyboardEvent.code to a KeyName. null if the key is not supported. */
export function codeToKey(code: string): KeyName | null {
  if (CODE_TO_KEY[code]) return CODE_TO_KEY[code]
  let m = /^Key([A-Z])$/.exec(code)
  if (m) return m[1]
  m = /^Digit(\d)$/.exec(code)
  if (m) return m[1]
  m = /^Numpad(\d)$/.exec(code)
  if (m) return `Num${m[1]}`
  m = /^F(\d{1,2})$/.exec(code)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 24) return code
  return null
}

/** Sort a combination so modifiers come first, in a fixed order. */
export function normalizeKeys(keys: KeyName[]): KeyName[] {
  const unique = [...new Set(keys)]
  const mods = MODIFIERS.filter((m) => unique.includes(m))
  return [...mods, ...unique.filter((k) => !MODIFIERS.includes(k))]
}

/** Text shown on a key chip. */
export function keyLabel(key: KeyName): string {
  const labels: Record<string, string> = {
    Left: '←', Right: '→', Up: '↑', Down: '↓', PageUp: 'Page Up', PageDown: 'Page Down',
    NumAdd: 'Num +', NumSub: 'Num −', NumMul: 'Num *', NumDiv: 'Num /', NumDec: 'Num .'
  }
  if (labels[key]) return labels[key]
  const m = /^Num(\d)$/.exec(key)
  return m ? `Num ${m[1]}` : key
}
