import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { IPC } from '@shared/api'
import { createDj } from './dj'

const electron = vi.hoisted(() => ({
  desktopCapturer: { getSources: vi.fn(async () => [{ id: 'screen:0' }]) },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { defaultSession: { setDisplayMediaRequestHandler: vi.fn() } }
}))
vi.mock('electron', () => electron)
afterEach(() => vi.restoreAllMocks())

function setup() {
  const mainFrame = {}
  const overlay = Object.assign(new EventEmitter(), { mainFrame, isDestroyed: () => false, send: vi.fn() })
  const media = {
    primeMedia: vi.fn(async () => true),
    touchMedia: vi.fn(async () => ({ positionMs: 1500, endMs: 5000, wasPlaying: true, readAtMs: Date.now() + 20 })),
    releaseMedia: vi.fn(async () => true)
  }
  const dj = createDj(overlay as unknown as Electron.WebContents, media)
  const turnStart = electron.ipcMain.on.mock.calls.at(-1)![1]
  const turnEnd = electron.ipcMain.handle.mock.calls.at(-1)![1]
  const request = electron.session.defaultSession.setDisplayMediaRequestHandler.mock.calls.at(-1)![0]
  return { dj, media, overlay, mainFrame, turnStart, turnEnd, request }
}

it('grants loopback only to the active overlay main frame', async () => {
  const { dj, mainFrame, request } = setup()
  const result = (frame: object) => new Promise(resolve => request({ frame, audioRequested: true, videoRequested: true }, resolve))
  expect(await result(mainFrame)).toEqual({})
  dj.setActive(true)
  expect(await result({})).toEqual({})
  expect(await result(mainFrame)).toEqual({ audio: 'loopback', video: { id: 'screen:0' } })
  dj.setActive(false)
  expect(await result(mainFrame)).toEqual({})
})

it('routes overlay touch and releases once at the needle position', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  const { dj, media, overlay, mainFrame, turnStart, turnEnd } = setup()
  dj.setActive(true)
  dj.turn(-1)
  expect(overlay.send).toHaveBeenLastCalledWith(IPC.pushDj, { type: 'detent', dir: -1 })
  turnStart({ senderFrame: {} })
  expect(media.touchMedia).not.toHaveBeenCalled()
  turnStart({ senderFrame: mainFrame })
  turnStart({ senderFrame: mainFrame })
  expect(media.touchMedia).toHaveBeenCalledOnce()
  await turnEnd({ senderFrame: {} }, -75)
  expect(media.releaseMedia).not.toHaveBeenCalled()
  await turnEnd({ senderFrame: mainFrame }, -75)
  expect(media.releaseMedia).toHaveBeenCalledExactlyOnceWith(1405)
  turnStart({ senderFrame: mainFrame })
  await dj.stop()
  expect(media.releaseMedia).toHaveBeenLastCalledWith(undefined)
})
