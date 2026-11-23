import {it, expect} from 'vitest'
import {defaultSettings} from '../../shared/defaults'
import {validate} from './validate'
it('round-trips a DJ system slot', () => {
 const s = defaultSettings()
 s.mainDial.slots[0] = { type: 'system', control: 'dj', step: 1 }
 expect(validate(s)).toEqual({settings:s, problems:[]})
})
it('migrates v1 without losing settings or order', () => {
 const s = defaultSettings()
 const legacy = {...s, version:1, mainDial:{system:s.mainDial.slots.slice(0,6).map(s => { const {type, ...rest} = s; return rest }), custom:s.mainDial.slots.slice(6)}}
 const result = validate(legacy)
 expect(result.problems).toEqual([]); expect(result.settings).toEqual(s)
})
it('older settings without defaultControl / defaultReturnMs migrate with no problems', () => {
 for (const version of [1, 2]) {
  const s: any = defaultSettings()
  delete s.general.defaultControl; delete s.general.defaultReturnMs
  const legacy = version === 1 ? {...s, version, mainDial:{system:s.mainDial.slots.slice(0,6).map(({type, ...rest}: any) => rest), custom:s.mainDial.slots.slice(6)}} : s
  const result = validate(legacy)
  expect(result.problems).toEqual([])
  expect(result.settings.general).toMatchObject({defaultControl:'volume', defaultReturnMs:20_000})
 }
})
it('keeps defaultControl: null and valid values', () => {
 const s = defaultSettings()
 s.general.defaultControl = null; s.general.defaultReturnMs = 8000
 expect(validate(s)).toEqual({settings:s, problems:[]})
 s.general.defaultControl = 'zoom'
 expect(validate(s).settings.general.defaultControl).toBe('zoom')
})
it('falls back / clamps invalid defaultControl and defaultReturnMs and records problems', () => {
 const s: any = defaultSettings()
 s.general.defaultControl = 'bogus'
 expect(validate(s)).toMatchObject({settings:{general:{defaultControl:'volume'}}, problems:['defaultControl']})
 s.general.defaultControl = 5
 expect(validate(s).problems).toEqual(['defaultControl'])
 s.general.defaultControl = 'volume'
 for (const [v, want] of [[10, 5000], [999_999, 300_000], ['x', 20_000], [NaN, 20_000]] as const) {
  s.general.defaultReturnMs = v
  const r = validate(s)
  expect(r.settings.general.defaultReturnMs).toBe(want); expect(r.problems).toEqual(['defaultReturnMs'])
 }
})
for (const n of [0, 3, 4, 5, 8, 10]) it(`bounds all ring arrays of length ${n}`, () => {
 const s = defaultSettings(), f = s.mainDial.slots[6]
 if (f.type !== 'folder') throw Error('fixture')
 f.items = Array(n).fill(null); s.apps[0].slots = Array(n).fill(null)
 s.mainDial.slots = [f, ...Array.from({length:Math.max(0,n-1)}, () => ({type:'empty' as const}))]
 if (!n) s.mainDial.slots = []
 const result = validate(s).settings, count = Math.min(8, Math.max(4,n))
 expect(result.mainDial.slots).toHaveLength(count); expect(result.apps[0].slots).toHaveLength(count)
 const folder = result.mainDial.slots[0]; if (n && folder.type === 'folder') expect(folder.items).toHaveLength(count)
})
