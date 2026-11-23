import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import koffi from 'koffi'
import { startHook } from './hook'

const { workers } = vi.hoisted(() => ({ workers: [] as any[] }))
vi.mock('node:worker_threads', () => ({ Worker: class extends EventEmitter {
  unref = vi.fn()
  constructor(..._args: any[]) { super(); workers.push(this) }
} }))
afterEach(() => vi.restoreAllMocks())

it('clears the native thread ID and exit listener when the worker dies', () => {
  const post = vi.fn(), error = vi.fn(), listeners = process.listenerCount('exit')
  vi.spyOn(koffi, 'load').mockReturnValue({ func: () => post } as never)
  const hook = startHook(() => {}, error), worker = workers.at(-1)
  worker.emit('message', { ready: 123 })
  expect(process.listenerCount('exit')).toBe(listeners + 1)
  expect(worker.unref).toHaveBeenCalled()
  worker.emit('exit', 1)
  hook.stop()
  expect(post).not.toHaveBeenCalled()
  expect(error).toHaveBeenCalledOnce()
  expect(process.listenerCount('exit')).toBe(listeners)
})

it('stops only once and removes the process exit listener', () => {
  const post = vi.fn(), listeners = process.listenerCount('exit')
  vi.spyOn(koffi, 'load').mockReturnValue({ func: () => post } as never)
  const hook = startHook(() => {}, () => {}), worker = workers.at(-1)
  worker.emit('message', { ready: 123 })
  hook.stop(); hook.stop()
  expect(post).toHaveBeenCalledExactlyOnceWith(123, 0x12, 0, 0)
  expect(process.listenerCount('exit')).toBe(listeners)
})
