import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SettingsStore } from '../../shared/contracts'
import type { Settings } from '../../shared/types'
import { defaultSettings } from '../../shared/defaults'
import { validate } from './validate'
export { validate } from './validate'

function rename(from: string, to: string) {
  for (let attempt = 0;; attempt++) {
    try { renameSync(from, to); return } catch (e) {
      if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
    }
  }
}
const parse = (content: string): unknown => JSON.parse(content.replace(/^\uFEFF/, ''))
function write(path: string, settings: Settings) {
  const temp = `${path}.${randomUUID()}.tmp`
  try { writeFileSync(temp, JSON.stringify(settings, null, 2), 'utf8'); rename(temp, path) }
  finally { try { unlinkSync(temp) } catch { /* already renamed */ } }
}
export function createSettingsStore(dir: string): SettingsStore & { lastProblems(): string[] } {
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, 'settings.json'), listeners = new Set<(s: Settings) => void>()
  let settings: Settings, problems: string[] = []
  let content: string | undefined
  try { content = readFileSync(path, 'utf8') } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }
  if (content === undefined) { settings = defaultSettings(); write(path, settings) }
  else {
    let raw: unknown
    try { raw = parse(content) } catch { rename(path, join(resolve(dir), `settings.broken-${Date.now()}-${randomUUID()}.json`)); problems = ['Invalid JSON']; settings = defaultSettings(); write(path, settings) }
    if (!settings!) { const result = validate(raw); settings = result.settings; problems = result.problems; if (problems.length) { copyFileSync(path, join(resolve(dir), `settings.broken-${Date.now()}-${randomUUID()}.json`)); write(path, settings) } else if ((raw as {version?:number})?.version === 1) write(path, settings) }
  }
  return { path, get: () => structuredClone(settings), lastProblems: () => [...problems], set(next) { const result = validate(next); write(path, result.settings); settings = result.settings; problems = result.problems; for (const cb of listeners) cb(structuredClone(settings)) }, onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb) } } }
}
export function exportSettings(store: SettingsStore, filePath: string): void { write(filePath, store.get()) }
export function importSettings(store: SettingsStore, filePath: string): { ok: boolean; problems: string[] } {
  try { const result = validate(parse(readFileSync(filePath, 'utf8'))); if (result.problems.some(p => p.includes('version'))) return {ok:false, problems:result.problems}; store.set(result.settings); return {ok:true, problems:result.problems} } catch (e) { return {ok:false, problems:[`Import failed: ${String(e)}`]} }
}
