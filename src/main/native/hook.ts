import { Worker } from 'node:worker_threads'
import koffi from 'koffi'
import type { NativeApi, Stoppable } from '../../shared/contracts'
import type { RawKnobEvent } from '../../shared/types'
import { KREO_INPUT_TAG } from './input'

export function classifyKnob(vk: number, down: boolean, held: boolean): { held: boolean; kind: RawKnobEvent['kind'] | null } {
  if (vk === 0xad) return { held: down, kind: down ? (held ? null : 'press') : (held ? 'release' : null) }
  return { held, kind: down ? (vk === 0xaf ? 'cw' : vk === 0xae ? 'ccw' : null) : null }
}

// This function is serialized after TypeScript compilation; keep it self-contained.
async function hookWorker(): Promise<void> {
  const { parentPort, workerData } = require('node:worker_threads')
  const k = require(workerData.koffiPath) as typeof koffi
  const u = k.load('user32.dll'), kernel = k.load('kernel32.dll')
  const flags = new Int32Array(workerData.flags)
  const classify = (0, eval)('(' + workerData.classify + ')') as typeof classifyKnob
  const proto = k.proto('intptr_t __stdcall KreoHook(int code, uintptr_t message, void *data)')
  const install = u.func('void * __stdcall SetWindowsHookExW(int, KreoHook *, void *, uint32_t)')
  const next = u.func('intptr_t __stdcall CallNextHookEx(void *, int, uintptr_t, void *)')
  const unhook = u.func('int __stdcall UnhookWindowsHookEx(void *)')
  const wait = u.func('uint32_t __stdcall MsgWaitForMultipleObjectsEx(uint32_t, void *, uint32_t, uint32_t, uint32_t)')
  const peek = u.func('int __stdcall PeekMessageW(void *, void *, uint32_t, uint32_t, uint32_t)')
  const getThread = kernel.func('uint32_t __stdcall GetCurrentThreadId()')
  const getModule = kernel.func('void * __stdcall GetModuleHandleW(str16)')
  const lastError = kernel.func('uint32_t __stdcall GetLastError()')
  let held = false, epoch = Atomics.load(flags, 2)
  const cb = k.register((code: number, message: number, data: bigint) => {
    const currentEpoch = Atomics.load(flags, 2)
    if (epoch !== currentEpoch) { held = false; epoch = currentEpoch }
    if (code === 0) {
      const vk = k.decode(data, 'uint32_t') as number
      if (vk >= 0xad && vk <= 0xaf) {
        if (Atomics.load(flags, 0)) { held = false; return next(null, code, message, data) }
        // Not the injected flag: Kreo's own software injects the knob keys. Skip only keys we sent.
        const extra = Number(k.decode(data, 16, 'uintptr_t'))
        if (extra !== workerData.ownTag) {
          const result = classify(vk, Number(message) === 0x100 || Number(message) === 0x104, held)
          held = result.held
          if (result.kind) parentPort.postMessage({ kind: result.kind, epoch })
          return 1
        }
      }
    }
    return next(null, code, message, data)
  }, k.pointer(proto))
  const msg = Buffer.alloc(48)
  peek(msg, null, 0, 0, 0) // Create the queue before publishing the thread id.
  let hook = install(13, cb, getModule(null), 0)
  if (!hook) { k.unregister(cb); throw new Error('SetWindowsHookExW failed: ' + lastError()) }
  parentPort.postMessage({ ready: getThread() })
  let renewed = Date.now()
  try {
    while (!Atomics.load(flags, 1)) {
      if (wait(0, null, 250, 0x4ff, 4) === 0xffffffff) throw new Error('Message wait failed: ' + lastError())
      while (peek(msg, null, 0, 0, 1)) {
        if (msg.readUInt32LE(process.arch === 'ia32' ? 4 : 8) === 0x12) return
      }
      if (!Atomics.load(flags, 1) && Date.now() - renewed >= workerData.refreshIntervalMs) {
        const replacement = install(13, cb, getModule(null), 0)
        if (!replacement) throw new Error('Hook renewal failed: ' + lastError())
        unhook(hook)
        hook = replacement
        renewed = Date.now()
        parentPort.postMessage({ renewed: true })
      }
      await new Promise<void>(resolve => setImmediate(resolve))
    }
  } finally { unhook(hook); k.unregister(cb); parentPort.close() }
}

export function startHook(onEvent: Parameters<NativeApi['startKnobHook']>[0], onError: (error: Error) => void, renewal?: { intervalMs: number; onRenewed(): void }): Stoppable & { setPassthrough(on: boolean): void } {
  const flags = new Int32Array(new SharedArrayBuffer(12))
  let stopped = false, failed = false, thread = 0
  const post = koffi.load('user32.dll').func('int __stdcall PostThreadMessageW(uint32_t, uint32_t, uintptr_t, intptr_t)')
  const worker = new Worker(`(${hookWorker.toString()})()`, { eval: true, workerData: {
    flags: flags.buffer, koffiPath: require.resolve('koffi').replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2'), classify: classifyKnob.toString(), ownTag: KREO_INPUT_TAG, refreshIntervalMs: renewal?.intervalMs ?? 60000
  } })
  const fail = (err: Error): void => { if (!stopped && !failed) { failed = true; onError(err) } }
  worker.on('message', (msg) => {
    if (msg.ready) { thread = msg.ready; if (stopped) post(thread, 0x12, 0, 0) }
    else if (msg.renewed) renewal?.onRenewed()
    else if (!stopped && !Atomics.load(flags, 0) && msg.epoch === Atomics.load(flags, 2)) onEvent({ kind: msg.kind })
  })
  worker.on('error', fail)
  worker.on('exit', (code) => { thread = 0; process.removeListener('exit', stop); fail(new Error(`Keyboard hook worker exited (${code})`)) })
  worker.unref()
  function stop(): void {
    if (stopped) return
    stopped = true
    process.removeListener('exit', stop)
    Atomics.store(flags, 1, 1)
    if (thread) post(thread, 0x12, 0, 0)
  }
  process.once('exit', stop)
  return {
    setPassthrough(on) { Atomics.store(flags, 0, on ? 1 : 0); Atomics.add(flags, 2, 1) },
    stop
  }
}
