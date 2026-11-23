import koffi from 'koffi'
import { win32 } from 'node:path'
import type { ForegroundApp } from '../../shared/contracts'

export function createProcesses() {
  const u = koffi.load('user32.dll'), k = koffi.load('kernel32.dll')
  const foreground = u.func('void * __stdcall GetForegroundWindow()')
  const windowPid = u.func('uint32_t __stdcall GetWindowThreadProcessId(void *, _Out_ uint32_t *)')
  const open = k.func('void * __stdcall OpenProcess(uint32_t, int, uint32_t)')
  const image = k.func('int __stdcall QueryFullProcessImageNameW(void *, uint32_t, void *, _Inout_ uint32_t *)')
  const close = k.func('int __stdcall CloseHandle(void *)')
  const snapshot = k.func('void * __stdcall CreateToolhelp32Snapshot(uint32_t, uint32_t)')
  const first = k.func('int __stdcall Process32FirstW(void *, void *)')
  const next = k.func('int __stdcall Process32NextW(void *, void *)')
  const enumProto = koffi.proto('__stdcall', 'int', ['void *', 'intptr_t'])
  const enumerate = u.func('EnumWindows', 'int', [koffi.pointer(enumProto), 'intptr_t'])
  const visible = u.func('int __stdcall IsWindowVisible(void *)')
  const owner = u.func('void * __stdcall GetWindow(void *, uint32_t)')
  const iconic = u.func('int __stdcall IsIconic(void *)')
  const show = u.func('int __stdcall ShowWindowAsync(void *, int)')
  const setFront = u.func('int __stdcall SetForegroundWindow(void *)')
  const bring = u.func('int __stdcall BringWindowToTop(void *)')
  const attach = u.func('int __stdcall AttachThreadInput(uint32_t, uint32_t, int)')
  const currentThread = k.func('uint32_t __stdcall GetCurrentThreadId()')

  function getForeground(): ForegroundApp | null {
    const hwnd = foreground()
    if (!hwnd) return null
    const pid = [0]
    windowPid(hwnd, pid)
    const handle = open(0x1000, 0, pid[0])
    if (!handle) return null
    try {
      const buffer = Buffer.alloc(65536), len = [32768]
      if (!image(handle, 0, buffer, len)) return null
      const exePath = buffer.toString('utf16le', 0, len[0] * 2)
      return { exePath, processName: win32.basename(exePath), pid: pid[0] }
    } finally { close(handle) }
  }

  function processIds(name: string): Set<number> {
    const ids = new Set<number>(), handle = snapshot(2, 0)
    if (!handle || handle === -1n || handle === 0xffffffffffffffffn) return ids
    // PROCESSENTRY32W: ULONG_PTR makes the x64 structure 568 bytes.
    const x64 = process.arch !== 'ia32', entry = Buffer.alloc(x64 ? 568 : 556)
    entry.writeUInt32LE(entry.length)
    try {
      let ok = first(handle, entry)
      while (ok) {
        const exe = entry.toString('utf16le', x64 ? 44 : 36).split('\0')[0]
        if (exe.toLowerCase() === name.toLowerCase()) ids.add(entry.readUInt32LE(8))
        ok = next(handle, entry)
      }
    } finally { close(handle) }
    return ids
  }

  return {
    getForeground,
    isProcessRunning(name: string) { return processIds(name).size > 0 },
    focusProcess(name: string): boolean {
      try {
        const ids = processIds(name)
        let target: bigint | null = null
        enumerate((hwnd: bigint) => {
          const pid = [0]
          windowPid(hwnd, pid)
          if (ids.has(pid[0]) && visible(hwnd) && !owner(hwnd, 4)) { target = hwnd; return 0 }
          return 1
        }, 0)
        if (!target) return false
        if (iconic(target)) show(target, 9)
        if (setFront(target)) return true
        const ownThread = currentThread(), pid = [0]
        const frontThread = windowPid(foreground(), pid), targetThread = windowPid(target, pid)
        const attached = [...new Set<number>([frontThread, targetThread])].filter(t => t && t !== ownThread && attach(ownThread, t, 1))
        try {
          bring(target)
          return Boolean(setFront(target))
        } finally { for (const t of attached) attach(ownThread, t, 0) }
      } catch { return false }
    }
  }
}
