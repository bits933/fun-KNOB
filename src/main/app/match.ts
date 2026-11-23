import { dirname, join } from 'node:path'
import type { PickedApp } from '../../shared/api'

export function matchInstalled(processName: string, installed: PickedApp[], exists: (path: string) => boolean): string | null {
  return installed.filter(a => a.processName.toLowerCase() === processName.toLowerCase() || exists(join(dirname(a.exePath), processName)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).at(-1)?.exePath ?? null
}
