import type { KreoApi } from '@shared/api'
import workletUrl from './dj-worklet?worker&url'

type WorkletEvent = { type: 'touch' } | { type: 'release'; offsetMs: number }
type Capture = { stream?: MediaStream; context?: AudioContext; node?: AudioWorkletNode }

export function listenForDj(api: KreoApi): void {
  let capture: Capture | undefined

  function stop(): void {
    const current = capture
    capture = undefined
    current?.node?.port.close()
    current?.stream?.getTracks().forEach(track => track.stop())
    void current?.context?.close().catch(() => {})
  }

  async function start(): Promise<void> {
    if (capture) return
    const current: Capture = {}
    capture = current
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      stream.getVideoTracks().forEach(track => track.stop())
      if (capture !== current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      current.stream = stream
      const track = stream.getAudioTracks()[0]
      if (!track) throw new Error('No loopback audio track')
      const lost = (error: unknown): void => {
        if (capture !== current) return
        console.warn('DJ audio capture ended', error)
        stop()
        void api.releaseDj(null).catch(console.warn)
      }
      track.addEventListener('ended', lost, { once: true })
      const context = current.context = new AudioContext({ latencyHint: 'interactive' })
      await context.audioWorklet.addModule(workletUrl)
      if (capture !== current) return
      const node = current.node = new AudioWorkletNode(context, 'kreo-dj', { outputChannelCount: [2] })
      node.addEventListener('processorerror', lost, { once: true })
      node.port.onmessage = async ({ data }: MessageEvent<WorkletEvent>) => {
        if (capture !== current) return
        if (data.type === 'touch') api.touchDj()
        else {
          try { await api.releaseDj(data.offsetMs) }
          catch (error) { console.warn('DJ media handoff failed', error) }
          if (capture === current) node.port.postMessage({ type: 'handoff' })
        }
      }
      context.createMediaStreamSource(stream).connect(node).connect(context.destination)
      await context.resume()
    } catch (error) {
      if (capture !== current) return
      stop()
      console.warn('DJ audio capture failed', error)
    }
  }

  const unsubscribe = api.onDj((event) => {
    if (event.type === 'detent') capture?.node?.port.postMessage({ ...event, atMs: performance.now() })
    else if (event.active) void start()
    else stop()
  })
  window.addEventListener('pagehide', () => { unsubscribe(); stop() }, { once: true })
}
