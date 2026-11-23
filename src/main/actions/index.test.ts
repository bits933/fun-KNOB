import { describe, it, expect, vi } from 'vitest'
import { createActions } from './index'
import type { NativeApi } from '../../shared/contracts'
import type { Settings } from '../../shared/types'

const settings = { apps: [], macros: [] } as unknown as Settings
function setup() {
  const native = { sendStroke: vi.fn(), typeText: vi.fn(), getVolume: vi.fn(() => 99), setVolume: vi.fn(), getMuted: vi.fn(() => true), setMuted: vi.fn(), getMicVolume: vi.fn(() => null), getBrightness: vi.fn(async () => 50), setBrightness: vi.fn(async (_n: number) => true), isProcessRunning: vi.fn(() => false) } as unknown as NativeApi
  const turnDj = vi.fn()
  return { native, turnDj, actions: createActions({ native, turnDj, openTarget: async () => {}, launchApp: async () => {} }) }
}
describe('actions', () => {
  it('starts an app that is running with no visible window instead of reporting it missing', async () => {
    const native = { isProcessRunning: vi.fn(() => true), focusProcess: vi.fn(() => false) } as unknown as NativeApi
    const launchApp = vi.fn(async () => {})
    const actions = createActions({ native, turnDj: vi.fn(), openTarget: async () => {}, launchApp })
    const app = { id: 'figma', name: 'Figma', icon: 'app-design', processName: 'Figma.exe', exePath: process.execPath, slots: [] }
    const result = await actions.run({ type: 'open-app', appId: 'figma' }, { apps: [app], macros: [] } as unknown as Settings)
    expect(launchApp).toHaveBeenCalledWith(process.execPath)
    expect(result).toMatchObject({ kind: 'message', label: 'Opening Figma' })
  })
  it('routes each DJ detent and shows the DJ pill', async () => {
    const { actions, native, turnDj } = setup()
    for (const dir of [-1, 1] as const) {
      expect(await actions.run({ type: 'system', control: 'dj', dir, step: 9 }, settings))
        .toEqual({ kind: 'message', icon: 'dj', label: 'DJ', value: null, percent: null })
    }
    expect(turnDj.mock.calls).toEqual([[-1], [1]])
    expect(native.sendStroke).not.toHaveBeenCalled()
  })
  it('clamps volume and unmutes on increase', async () => {
    const { actions, native } = setup()
    expect(await actions.run({ type: 'system', control: 'volume', dir: 1, step: 5 }, settings)).toMatchObject({ value: '100%', percent: 100 })
    expect(native.setMuted).toHaveBeenCalledWith(false)
  })
  it('handles missing devices and native errors', async () => {
    const { actions, native } = setup()
    expect((await actions.run({ type: 'system', control: 'mic', dir: 1, step: 1 }, settings))?.kind).toBe('warning')
    vi.mocked(native.sendStroke).mockImplementation(() => { throw Error() })
    expect((await actions.run({ type: 'play-pause' }, settings))?.kind).toBe('warning')
  })
  it('holds and releases alt', async () => {
    vi.useFakeTimers()
    const { native, turnDj } = setup(); const down = vi.fn(), up = vi.fn()
    const actions = createActions({ native, turnDj, openTarget: async () => {}, launchApp: async () => {}, keyDown: down, keyUp: up })
    await actions.run({ type: 'system', control: 'switch-apps', dir: 1, step: 1 }, settings)
    await actions.run({ type: 'system', control: 'switch-apps', dir: -1, step: 1 }, settings)
    expect(down).toHaveBeenCalledTimes(1); vi.advanceTimersByTime(700); expect(up).toHaveBeenCalledWith('Alt')
    vi.useRealTimers()
  })
})
