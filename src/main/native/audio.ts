import koffi from 'koffi'
import type { TypeObject } from 'koffi'

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Percent must be finite')
  return Math.max(0, Math.min(100, value))
}

export function createAudio() {
  const ole = koffi.load('ole32.dll')
  const init = ole.func('int32_t __stdcall CoInitializeEx(void *, uint32_t)')
  const uninit = ole.func('void __stdcall CoUninitialize()')
  const create = ole.func('int32_t __stdcall CoCreateInstance(void *, void *, uint32_t, void *, _Out_ void **)')
  const parse = ole.func('int32_t __stdcall CLSIDFromString(str16, void *)')
  const guid = (id: string): Buffer => { const b = Buffer.alloc(16); if (parse(id, b) < 0) throw new Error('Invalid GUID'); return b }
  const cls = guid('{BCDE0395-E52F-467C-8E3D-C4579291692E}')
  const iid = guid('{A95664D2-9614-4F35-A746-DE8DB63617E6}')
  const volumeId = guid('{5CDF2C82-841E-4546-9722-0CF74078229A}')
  const protos = {
    release: koffi.proto('__stdcall', 'uint32_t', ['void *']),
    endpoint: koffi.proto('__stdcall', 'int32_t', ['void *', 'int', 'int', koffi.out('void **')]),
    activate: koffi.proto('__stdcall', 'int32_t', ['void *', 'void *', 'uint32_t', 'void *', koffi.out('void **')]),
    getLevel: koffi.proto('__stdcall', 'int32_t', ['void *', koffi.out('float *')]),
    setLevel: koffi.proto('__stdcall', 'int32_t', ['void *', 'float', 'void *']),
    getMute: koffi.proto('__stdcall', 'int32_t', ['void *', koffi.out('int *')]),
    setMute: koffi.proto('__stdcall', 'int32_t', ['void *', 'int', 'void *'])
  }
  const invoke = (ptr: bigint, slot: number, proto: TypeObject, ...args: unknown[]): number => {
    const table = koffi.decode(ptr, 'void *')
    const fn = koffi.decode(table, slot * koffi.sizeof('void *'), 'void *')
    return koffi.call(fn, proto, ptr, ...args)
  }
  let initialized = false, ownsCom = false, disposed = false
  function endpoint<T>(capture: boolean, action: (ptr: bigint) => T): T | null {
    if (disposed) return null
    if (!initialized) {
      const hr = init(null, 0)
      if (hr < 0 && hr !== -2147417850) return null // RPC_E_CHANGED_MODE: COM is already initialized STA.
      initialized = true; ownsCom = hr >= 0
    }
    const enumerator: bigint[] = [0n], device: bigint[] = [0n], volume: bigint[] = [0n]
    try {
      if (create(cls, null, 1, iid, enumerator) < 0) return null
      if (invoke(enumerator[0], 4, protos.endpoint, capture ? 1 : 0, 1, device) < 0) return null
      if (invoke(device[0], 3, protos.activate, volumeId, 23, null, volume) < 0) return null
      return action(volume[0])
    } finally {
      for (const ptr of [volume[0], device[0], enumerator[0]]) if (ptr) invoke(ptr, 2, protos.release)
    }
  }
  return {
    getVolume(capture = false): number | null {
      return endpoint(capture, ptr => { const out = [0]; return invoke(ptr, 9, protos.getLevel, out) < 0 ? null : Math.round(out[0] * 100) })
    },
    setVolume(value: number, capture = false): void {
      const scalar = clampPercent(value) / 100
      endpoint(capture, ptr => { if (invoke(ptr, 7, protos.setLevel, scalar, null) < 0) throw new Error('Could not set endpoint volume') })
    },
    getMuted(): boolean | null {
      return endpoint(false, ptr => { const out = [0]; return invoke(ptr, 15, protos.getMute, out) < 0 ? null : Boolean(out[0]) })
    },
    setMuted(muted: boolean): void {
      endpoint(false, ptr => { if (invoke(ptr, 14, protos.setMute, muted ? 1 : 0, null) < 0) throw new Error('Could not set endpoint mute') })
    },
    dispose() { if (disposed) return; disposed = true; if (ownsCom) uninit() }
  }
}
