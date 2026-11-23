import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSettingsStore, exportSettings, importSettings, validate } from './index'
import { defaultSettings } from '../../shared/defaults'

describe('settings', () => {
  it('creates, saves, imports and notifies without temp files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kreo-'))
    try { const store = createSettingsStore(dir); expect(JSON.parse(readFileSync(store.path, 'utf8'))).toEqual(defaultSettings())
      let count = 0; const off = store.onChange(() => count++); const value = store.get(); value.enabled = false; store.set(value); off(); exportSettings(store, join(dir,'export.json')); store.set(defaultSettings()); expect(importSettings(store, join(dir,'export.json')).ok).toBe(true); expect(store.get().enabled).toBe(false); expect(count).toBe(1); expect(readdirSync(dir).some(x => x.endsWith('.tmp'))).toBe(false)
    } finally { rmSync(dir,{recursive:true,force:true}) }
  })
  it('backs up broken files and repairs invalid values', () => { const dir = mkdtempSync(join(tmpdir(),'kreo-')); try { writeFileSync(join(dir,'settings.json'),'{'); const store = createSettingsStore(dir); expect(store.lastProblems().length).toBeGreaterThan(0); expect(readdirSync(dir).some(x => x.startsWith('settings.broken-'))).toBe(true)
    const result = validate({version:1, general:{dialSizePercent:500}}); expect(result.settings.general.dialSizePercent).toBe(140); const lv = validate({version:1, general:{levelSizePercent:5, levelPosition:'nowhere'}}); expect(lv.settings.general.levelSizePercent).toBe(40); expect(lv.settings.general.levelPosition).toBe('center'); expect(validate({version:1, general:{levelPosition:'top-right', levelSizePercent:70}}).settings.general).toMatchObject({levelPosition:'top-right', levelSizePercent:70}); expect(result.settings.mainDial.slots).toHaveLength(8); expect(result.problems.length).toBeGreaterThan(0)
  } finally { rmSync(dir,{recursive:true,force:true}) } })
})
