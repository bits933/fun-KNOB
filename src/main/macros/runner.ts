import type { Macro, Stroke } from '../../shared/types'

export function createMacroRunner(deps: { sendStroke(s: Stroke): void; typeText(t: string): void; open(target: string): Promise<void>; sleep?(ms: number, signal: AbortSignal): Promise<void> }) {
  let current: { id: string; controller: AbortController; done: Promise<unknown> } | null = null
  const listeners = new Set<(id: string | null) => void>()
  const emit = (id: string | null) => { for (const cb of listeners) { try { cb(id) } catch { /* listeners do not control execution */ } } }
  const sleep = deps.sleep ?? ((ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('aborted')); return }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    const abort = () => { clearTimeout(timer); reject(new Error('aborted')) }
    signal.addEventListener('abort', abort, { once: true })
  }))
  let sequence = 0
  return {
    async run(macro: Macro): Promise<'done' | 'stopped' | 'failed'> {
      const ticket = ++sequence
      if (current) { current.controller.abort(); await current.done }
      if (ticket !== sequence) return 'stopped'
      const controller = new AbortController()
      let finish!: () => void
      const done = new Promise<void>((resolve) => { finish = resolve })
      const entry = { id: macro.id, controller, done }
      current = entry
      emit(macro.id)
      try {
        for (let i = 0; i < macro.steps.length; i++) {
          if (controller.signal.aborted) return 'stopped'
          const step = macro.steps[i]
          if (step.type === 'keys') deps.sendStroke({ type: 'keys', keys: step.keys })
          else if (step.type === 'text') deps.typeText(step.text)
          else if (step.type === 'open') await new Promise<void>((resolve, reject) => {
            const signal = controller.signal
            const abort = () => { signal.removeEventListener('abort', abort); reject(new Error('aborted')) }
            signal.addEventListener('abort', abort, { once: true })
            if (signal.aborted) abort()
            else Promise.resolve().then(() => deps.open(step.target)).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
          })
          else await sleep(step.ms, controller.signal)
          if (controller.signal.aborted) return 'stopped'
          if (i < macro.steps.length - 1) await sleep(30, controller.signal)
        }
        return controller.signal.aborted ? 'stopped' : 'done'
      } catch { return controller.signal.aborted ? 'stopped' : 'failed' }
      finally { if (current === entry) { current = null; emit(null) }; finish() }
    },
    stop() { sequence++; current?.controller.abort() },
    running() { return current?.id ?? null },
    onState(cb: (id: string | null) => void) { listeners.add(cb); return () => { listeners.delete(cb) } }
  }
}

