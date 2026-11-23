import { it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../../shared/defaults'
import { createSettingsStore, importSettings, validate } from './index'

it('backs up parseable invalid settings before repair', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kreo-'))
  try { const original = '{"version":2}'; writeFileSync(join(dir, 'settings.json'), original); createSettingsStore(dir); const backup = readdirSync(dir).find(x => x.startsWith('settings.broken-'))!; expect(readFileSync(join(dir, backup), 'utf8')).toBe(original) } finally { rmSync(dir, { recursive:true, force:true }) }
})
it('preserves cleared strokes and repairs wheel modifiers and steps', () => {
  const value = defaultSettings(), slot = value.apps[0].slots[0]!
  slot.left = null; slot.right = null; slot.click = null
  value.apps[0].slots[1]!.left = { type:'wheel', dir:'up', mods:['Ctrl', 'A'] }
  ;(value.mainDial.slots[0] as import('../../shared/types').SystemSlot).step = 1.6
  const result = validate(value)
  expect(result.settings.apps[0].slots[0]).toMatchObject({left:null,right:null,click:null})
  expect(result.settings.apps[0].slots[1]!.left).toMatchObject({mods:['Ctrl']})
  expect((result.settings.mainDial.slots[0] as import('../../shared/types').SystemSlot).step).toBe(2)
  expect(result.problems.length).toBeGreaterThan(0)
})
it('drops empty and duplicate app and macro ids', () => {
  const value = defaultSettings(); value.apps.push(value.apps[0], {...value.apps[0], id:''}); value.macros = [{id:'m',name:'',icon:'',steps:[]},{id:'m',name:'',icon:'',steps:[]},{id:'',name:'',icon:'',steps:[]}]
  const result = validate(value); expect(result.settings.apps).toHaveLength(value.apps.length - 2); expect(result.settings.macros).toHaveLength(1); expect(result.problems.length).toBeGreaterThanOrEqual(4)
})
it('accepts BOM on load and import', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kreo-'))
  try { const file = join(dir,'settings.json'); writeFileSync(file, '\ufeff' + JSON.stringify(defaultSettings())); const store = createSettingsStore(dir); expect(store.lastProblems()).toEqual([]); expect(importSettings(store, file).ok).toBe(true) } finally { rmSync(dir,{recursive:true,force:true}) }
})

import * as fs from 'node:fs'
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, renameSync: vi.fn(actual.renameSync) }
})
it('retries transient rename failures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kreo-'))
  try {
    const rename = vi.mocked(fs.renameSync)
    rename.mockImplementationOnce(() => { throw Object.assign(new Error('busy'), {code:'EBUSY'}) })
    createSettingsStore(dir)
    expect(rename).toHaveBeenCalledTimes(2)
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
