import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { Worker } from 'node:worker_threads'
import { createNative } from './index'
import { startHook } from './hook'
import { createInputSender, strokeInputs } from './input'

async function smoke(): Promise<void> {
  if (process.argv.includes('--exit-with-hook') || process.argv.includes('--natural-exit-hook')) {
    startHook(() => {}, error => { throw error })
    setTimeout(() => {
      console.log('Exiting with hook active, without stop/dispose.')
      if (process.argv.includes('--exit-with-hook')) process.exit(0)
    }, 500)
    return
  }
  const manual = process.argv.includes('--manual')
  // Imitate the knob: untagged injected keys, exactly what Kreo's keyboard software sends.
  const untagged = createInputSender(0)
  const knob = (key: string): void => untagged(strokeInputs({ type: 'keys', keys: [key] }))
  const native = createNative()
  if (process.argv.includes('--system')) console.log({ foreground: native.getForeground(), nodeRunning: native.isProcessRunning('node.exe'), volume: native.getVolume(), mic: native.getMicVolume(), brightness: await native.getBrightness() })
  let fatal: Error | null = null
  const received: { kind: string; at: number }[] = []
  const hook = native.startKnobHook(e => {
    received.push({ kind: e.kind, at: performance.now() })
    if (manual) console.log(new Date().toISOString(), e.kind)
  }, error => { fatal = error; console.error(error); if (manual) { native.dispose(); process.exitCode = 1 } })
  if (manual) {
    console.log('Listening for real knob events. Volume keys are swallowed. Ctrl+C to stop.')
    process.once('SIGINT', () => native.dispose())
    return
  }
  try {
    await delay(500)
    if (fatal) throw fatal
    const before = native.getVolume(), muted = native.getMuted()
    assert.notEqual(before, null, 'No render endpoint: cannot prove volume unchanged')
    const latencies: number[] = []
    for (let i = 0; i < 10; i++) {
      for (const [key, expected] of [['VolumeUp', ['cw']], ['VolumeDown', ['ccw']], ['VolumeMute', ['press', 'release']]] as const) {
        const start = received.length, at = performance.now()
        knob(key)
        const deadline = performance.now() + 1000
        while (received.length < start + expected.length && performance.now() < deadline) await delay(1)
        if (fatal) throw fatal
        assert.deepEqual(received.slice(start).map(e => e.kind), expected)
        latencies.push(...received.slice(start).map(e => e.at - at))
        assert.ok(Math.abs(native.getVolume()! - before!) < 0.01, 'System volume changed')
        assert.equal(native.getMuted(), muted, 'System mute changed')
      }
    }
    console.log(JSON.stringify({ events: received.length, maxLatencyMs: Math.max(...latencies), meanLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length, volumeBefore: before, volumeAfter: native.getVolume(), mutedBefore: muted, mutedAfter: native.getMuted() }, null, 2))
    assert.ok(Math.max(...latencies) < 30, 'Latency exceeded 30 ms')
    const start = received.length
    // Inject while Electron's main thread is deliberately busy; the hook must still swallow.
    const injector = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads')
      const k = require(workerData.koffiPath)
      const send = k.load('user32.dll').func('uint32_t __stdcall SendInput(uint32_t, void *, int)')
      const size = process.arch === 'ia32' ? 28 : 40, offset = size === 40 ? 8 : 4
      const inputs = Buffer.alloc(size * 4)
      for (let i = 0; i < 4; i++) {
        inputs.writeUInt32LE(1, i * size)
        inputs.writeUInt16LE(i < 2 ? 0xae : 0xaf, i * size + offset)
        inputs.writeUInt32LE(i % 2 ? 2 : 0, i * size + offset + 4)
      }
      parentPort.postMessage('ready')
      setTimeout(() => { parentPort.postMessage(send(4, inputs, size)); parentPort.close() }, 25)
    `, { eval: true, workerData: { koffiPath: require.resolve('koffi') } })
    await new Promise<void>((resolve, reject) => { injector.once('message', () => resolve()); injector.once('error', reject) })
    const injected = new Promise<number>((resolve, reject) => { injector.once('message', resolve); injector.once('error', reject) })
    const busyUntil = performance.now() + 200
    while (performance.now() < busyUntil) { /* Intentionally block this thread, never the hook thread. */ }
    assert.equal(await injected, 4)
    await delay(50)
    assert.deepEqual(received.slice(start).map(e => e.kind), ['ccw', 'cw'])
    assert.ok(Math.abs(native.getVolume()! - before!) < 0.01)
    console.log('Main-thread 200 ms stall: both events captured; volume unchanged.')
    const ownStart = received.length
    native.sendStroke({ type: 'keys', keys: ['VolumeUp'] })
    native.sendStroke({ type: 'keys', keys: ['VolumeDown'] })
    await delay(150)
    assert.equal(received.length, ownStart, 'Hook caught a key Kreo Dial sent itself')
    console.log('Own (tagged) volume keys passed through, not caught.')
    hook.stop()
    let renewals = 0
    const renewedEvents: string[] = []
    const renewingHook = startHook(e => renewedEvents.push(e.kind), error => { fatal = error }, {
      intervalMs: 250, onRenewed: () => { renewals++ }
    })
    try {
      const deadline = performance.now() + 3000
      while (!renewals && !fatal && performance.now() < deadline) await delay(10)
      if (fatal) throw fatal
      assert.ok(renewals > 0, 'Hook never confirmed forced renewal')
      for (const key of ['VolumeUp', 'VolumeDown', 'VolumeMute']) knob(key)
      const eventDeadline = performance.now() + 1000
      while (renewedEvents.length < 4 && performance.now() < eventDeadline) await delay(1)
      assert.deepEqual(renewedEvents, ['cw', 'ccw', 'press', 'release'])
      assert.ok(Math.abs(native.getVolume()! - before!) < 0.01)
      assert.equal(native.getMuted(), muted)
      console.log('Forced hook renewal: all 4 events captured; volume/mute unchanged.')
    } finally { renewingHook.stop() }
  } finally { hook.stop(); native.dispose() }
}
void smoke().catch(error => { console.error(error); process.exitCode = 1 })
