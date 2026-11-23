import { afterEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import koffi from 'koffi'
import { createInputSender, strokeInputs } from './input'
import { createBrightness, createSystemWorker } from './brightness'
import { createProcesses } from './processes'

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn }))
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('preserves VKs for numpad and layout-sensitive shortcuts, with media VK-only', () => {
  let buffer: Buffer = Buffer.alloc(0)
  vi.spyOn(koffi, 'load').mockReturnValue({ func: (signature: string) => signature.includes('SendInput')
    ? (count: number, bytes: Buffer) => { buffer = bytes; return count }
    : () => 0x2c } as never)
  const send = createInputSender()
  for (const [key, vk, scan] of [['Num4', 0x64, 0x2c], ['Z', 0x5a, 0x2c], ['VolumeUp', 0xaf, 0]] as const) {
    send(strokeInputs({ type: 'keys', keys: [key] }))
    const offset = process.arch === 'ia32' ? 4 : 8
    expect(buffer.readUInt16LE(offset)).toBe(vk)
    expect(buffer.readUInt16LE(offset + 2)).toBe(scan)
    expect(buffer.readUInt32LE(offset + 4) & 8).toBe(0)
  }
})

function fakeChild() {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })
  const writes: string[] = []
  child.stdin.on('data', line => writes.push(String(line)))
  spawn.mockReturnValue(child)
  return { child, writes }
}

it('runs the brightness and DJ protocols through the same worker', async () => {
  const { child, writes } = fakeChild(), worker = createSystemWorker()
  try {
    const brightness = worker.get()
    const status = worker.primeMedia()
    const touch = worker.touchMedia()
    const release = worker.releaseMedia(925)
    child.stdout.write('1 value 50\n')
    child.stdout.write('2 media 1000 5000 1 1795400000000\n')
    child.stdout.write('3 media 1000 5000 1 1795400000000\n')
    child.stdout.write('4 ok\n')
    expect(await Promise.all([brightness, status, touch, release])).toEqual([
      50, true, { positionMs: 1000, endMs: 5000, wasPlaying: true, readAtMs: 1795400000000 }, true
    ])
    expect(writes).toEqual(['1 get\n', '2 media-status\n', '3 media-touch\n', '4 media-release 925\n'])
  } finally { worker.dispose() }
})

it('coalesces pending brightness sets and starts their timeout only when written', async () => {
  vi.useFakeTimers()
  const { child, writes } = fakeChild(), brightness = createBrightness()
  try {
    const first = brightness.set(10)
    await vi.advanceTimersByTimeAsync(9000)
    const superseded = brightness.set(20), latest = brightness.set(30)
    expect(writes).toEqual(['1 set 10\n'])
    child.stdout.write('1 ok\n')
    await expect(first).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(9000)
    expect(writes).toEqual(['1 set 10\n', '2 set 30\n'])
    expect(child.kill).not.toHaveBeenCalled()
    child.stdout.write('2 ok\n')
    await expect(Promise.all([superseded, latest])).resolves.toEqual([true, true])
  } finally { brightness.dispose() }
})

it('settles active and coalesced brightness callers on disposal', async () => {
  fakeChild()
  const brightness = createBrightness()
  const calls = [brightness.set(10), brightness.set(20), brightness.set(30)]
  brightness.dispose()
  await expect(Promise.all(calls)).resolves.toEqual([false, false, false])
})

it('settles all brightness callers when an active command times out', async () => {
  vi.useFakeTimers()
  const { child } = fakeChild(), brightness = createBrightness()
  try {
    const calls = [brightness.set(10), brightness.set(20), brightness.set(30)]
    await vi.advanceTimersByTimeAsync(10000)
    await expect(Promise.all(calls)).resolves.toEqual([false, false, false])
    expect(child.kill).toHaveBeenCalledOnce()
  } finally { brightness.dispose() }
})

it('focuses through thread attachment without injecting Alt and returns false on failure', () => {
  const calls: string[] = []
  let fail = false, attempts = 0
  const functions: Record<string, (...args: any[]) => any> = {
    CreateToolhelp32Snapshot: () => 1n,
    Process32FirstW: (_handle, entry: Buffer) => { entry.writeUInt32LE(42, 8); entry.write('test.exe\0', process.arch === 'ia32' ? 36 : 44, 'utf16le'); return 1 },
    Process32NextW: () => 0,
    EnumWindows: cb => cb(2n),
    GetWindowThreadProcessId: (_hwnd, pid) => { pid[0] = 42; return 7 },
    IsWindowVisible: () => 1,
    GetWindow: () => null,
    GetCurrentThreadId: () => 5,
    GetForegroundWindow: () => 3n,
    SetForegroundWindow: () => { if (fail) throw new Error('native failure'); return attempts++ > 0 ? 1 : 0 },
    AttachThreadInput: (_from, _to, on) => { calls.push(`attach:${on}`); return 1 }
  }
  vi.spyOn(koffi, 'load').mockReturnValue({ func: (signature: string) => {
    const name = signature.includes('(') ? /([\w]+)\(/.exec(signature)![1] : signature
    return (...args: any[]) => { calls.push(name); return functions[name]?.(...args) ?? 0 }
  } } as never)
  const processes = createProcesses()
  expect(processes.focusProcess('test.exe')).toBe(true)
  expect(calls).toContain('attach:1')
  expect(calls).toContain('attach:0')
  expect(calls).not.toContain('SendInput')
  fail = true
  expect(processes.focusProcess('test.exe')).toBe(false)
})
