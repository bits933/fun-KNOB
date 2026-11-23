import type { DjMedia, NativeApi, Stoppable } from '../../shared/contracts'
import { createAudio } from './audio'
import { createSystemWorker } from './brightness'
import { startHook } from './hook'
import { createInputSender, keyInputs, strokeInputs, textInputs } from './input'
import { createProcesses } from './processes'

export function createNative(): NativeApi & DjMedia {
  if (process.platform !== 'win32') throw new Error('Kreo native API requires Windows')
  const send = createInputSender(), audio = createAudio(), system = createSystemWorker()
  const processes = createProcesses()
  const resources = new Set<Stoppable>()
  let disposed = false
  const live = (): void => { if (disposed) throw new Error('Native API is disposed') }
  return {
    startKnobHook(onEvent, onError) {
      live()
      const hook = startHook(onEvent, onError)
      const resource = { setPassthrough: hook.setPassthrough, stop() { hook.stop(); resources.delete(resource) } }
      resources.add(resource)
      return resource
    },
    sendStroke(stroke, repeat) { live(); send(strokeInputs(stroke, repeat)) },
    typeText(text) { live(); send(textInputs(text)) },
    keyDown(key) { live(); send(keyInputs(key, false)) },
    keyUp(key) { live(); send(keyInputs(key, true)) },
    getForeground: processes.getForeground,
    isProcessRunning: processes.isProcessRunning,
    focusProcess: processes.focusProcess,
    watchForeground(cb) {
      live()
      let previous = processes.getForeground()
      cb(previous)
      const timer = setInterval(() => {
        const current = processes.getForeground()
        if (current?.pid !== previous?.pid || current?.exePath !== previous?.exePath) { previous = current; cb(current) }
      }, 200)
      const resource = { stop() { clearInterval(timer); resources.delete(resource) } }
      resources.add(resource)
      return resource
    },
    getVolume: () => audio.getVolume(),
    setVolume: value => audio.setVolume(value),
    getMuted: audio.getMuted,
    setMuted: audio.setMuted,
    getMicVolume: () => audio.getVolume(true),
    setMicVolume: value => audio.setVolume(value, true),
    getBrightness: system.get,
    setBrightness: system.set,
    primeMedia: system.primeMedia,
    touchMedia: system.touchMedia,
    releaseMedia: system.releaseMedia,
    dispose() {
      if (disposed) return
      disposed = true
      for (const resource of resources) resource.stop()
      resources.clear(); system.dispose(); audio.dispose()
    }
  }
}
