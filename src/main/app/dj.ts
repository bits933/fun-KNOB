import { desktopCapturer, ipcMain, session, type WebContents } from 'electron'
import { IPC, type DjEvent } from '@shared/api'
import type { DjMedia, MediaTouch } from '@shared/contracts'
import { seekAfterScratch } from '@shared/dj'

export function createDj(overlay: WebContents, media: DjMedia) {
  let active = false
  let touch: { atMs: number; snapshot: Promise<MediaTouch | null> } | undefined
  let handoff: Promise<void> | undefined
  const ownsFrame = (frame: Electron.WebFrameMain | null): boolean =>
    frame !== null && !overlay.isDestroyed() && frame === overlay.mainFrame
  const send = (event: DjEvent): void => {
    if (!overlay.isDestroyed()) overlay.send(IPC.pushDj, event)
  }

  function finish(offsetMs: number | null): Promise<void> | undefined {
    if (!touch) return handoff
    const { atMs, snapshot } = touch
    touch = undefined
    const finishing = snapshot.then(async (position) => {
      if (!position?.wasPlaying) return
      const touchOffsetMs = 'readAtMs' in position && typeof position.readAtMs === 'number'
        ? atMs - position.readAtMs
        : 0
      const seek = offsetMs === null || position.endMs === 0
        ? undefined
        : seekAfterScratch(position.positionMs, position.endMs, offsetMs + touchOffsetMs)
      if (!await media.releaseMedia(seek)) console.warn('DJ could not complete the YouTube Music handoff')
    }).catch((error) => console.warn('DJ media handoff failed', error)).finally(() => {
      if (handoff === finishing) handoff = undefined
    })
    handoff = finishing
    return finishing
  }

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!active || !ownsFrame(request.frame) || !request.audioRequested || !request.videoRequested) {
      callback({})
      return
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }).catch(() => [])
    callback(active && ownsFrame(request.frame) && sources[0] ? { video: sources[0], audio: 'loopback' } : {})
  })

  ipcMain.on(IPC.touchDj, (event) => {
    if (!active || !ownsFrame(event.senderFrame) || touch) return
    const atMs = Date.now()
    const start = () => active ? media.touchMedia() : null
    const snapshot = Promise.resolve(handoff ? handoff.then(start) : start()).catch((error) => {
      console.warn('DJ could not pause YouTube Music', error)
      return null
    })
    touch = { atMs, snapshot }
  })
  ipcMain.handle(IPC.releaseDj, async (event, offsetMs: unknown) => {
    if (!ownsFrame(event.senderFrame)) return
    if (offsetMs !== null && (typeof offsetMs !== 'number' || !Number.isFinite(offsetMs))) return
    await finish(offsetMs)
  })
  overlay.on('did-finish-load', () => send({ type: 'active', active }))
  overlay.on('did-start-loading', () => { void finish(null) })
  overlay.on('render-process-gone', () => { void finish(null) })
  overlay.on('destroyed', () => { void finish(null) })

  function setActive(next: boolean): void {
    if (active === next) return
    active = next
    send({ type: 'active', active })
    if (active) void media.primeMedia().catch(console.warn)
    else void finish(null)
  }

  return {
    setActive,
    turn(dir: -1 | 1): void { if (active) send({ type: 'detent', dir }) },
    stop(): Promise<void> | undefined { setActive(false); return handoff }
  }
}
