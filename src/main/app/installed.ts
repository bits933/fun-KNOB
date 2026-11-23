import { shell } from 'electron'
import { existsSync, readdirSync, type Dirent } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { PickedApp } from '../../shared/api'

let cached: PickedApp[] = []
let expires = 0
export function listInstalledApps(): PickedApp[] {
  if (Date.now() < expires) return cached
  const found = new Map<string, PickedApp>()
  const scan = (dir: string): void => {
    let entries: Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) scan(path)
      else if (entry.isFile() && /\.lnk$/i.test(entry.name) && !/uninstall|readme|help|documentation|setup|updater/i.test(entry.name)) {
        try {
          const exePath = shell.readShortcutLink(path).target
          if (/\.exe$/i.test(exePath) && existsSync(exePath)) found.set(exePath.toLowerCase(), { name: basename(entry.name, extname(entry.name)), exePath, processName: basename(exePath) })
        } catch { /* Ignore broken shortcuts. */ }
      }
    }
  }
  for (const root of [process.env.ProgramData, process.env.AppData]) if (root) scan(join(root, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  cached = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  expires = Date.now() + 60_000
  return cached
}
