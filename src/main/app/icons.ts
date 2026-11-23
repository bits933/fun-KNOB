// An .exe's real Windows icon as a PNG data URL, for app slots in the overlay and dashboard.
import { existsSync } from 'node:fs'
import { app, nativeImage, type NativeImage } from 'electron'

const cache = new Map<string, Promise<string | null>>()

async function read(exePath: string): Promise<string | null> {
  if (!exePath || !existsSync(exePath)) return null
  const tries: Array<() => Promise<NativeImage>> = [
    () => nativeImage.createThumbnailFromPath(exePath, { width: 64, height: 64 }), // sharp large icon on Windows
    () => app.getFileIcon(exePath, { size: 'large' }),
  ]
  for (const t of tries) {
    try {
      const img = await t()
      if (!img.isEmpty()) return img.toDataURL()
    } catch { /* next */ }
  }
  return null
}

export function getAppIcon(exePath: string): Promise<string | null> {
  const key = (exePath ?? '').toLowerCase()
  let p = cache.get(key)
  if (!p) { p = read(exePath); cache.set(key, p) }
  return p
}
