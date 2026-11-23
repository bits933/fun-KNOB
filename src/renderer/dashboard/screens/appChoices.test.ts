import { expect, it } from 'vitest'
import { defaultSettings } from '@shared/defaults'
import { mergeAppChoices, saveSlotApps } from './appChoices'

it('merges and sorts apps, ignoring case for process and nonempty path', () => {
  const app = { id: 'a', name: 'Zed', processName: 'Z.exe', exePath: 'C:\\Z.exe' }
  expect(mergeAppChoices([app], [
    { ...app, name: 'Duplicate process', processName: 'z.EXE', exePath: '' },
    { ...app, name: 'Duplicate path', processName: 'other.exe', exePath: 'c:\\z.EXE' },
    { name: 'Alpha', processName: 'a.exe', exePath: '' }
  ]).map(a => a.name)).toEqual(['Alpha', 'Zed'])
})

it('saves draft folder items and creates only referenced apps, reusing existing processes', () => {
  const s = defaultSettings()
  const draft = { ...s.apps[0], id: 'draft', processName: 'new.exe', exePath: 'C:\\new.exe' }
  const reused = { ...s.apps[1], id: 'reuse', processName: 'FIGMA.EXE' }
  const result = saveSlotApps(s, { type: 'folder', name: 'Test', icon: 'folder', items: [
    { type: 'app', appId: 'draft' }, { type: 'app', appId: 'draft' }, { type: 'app', appId: 'reuse' },
    { type: 'macro', macroId: 'm' }, null, null, null, null
  ] }, [draft, reused, { ...draft, id: 'unused', processName: 'unused.exe' }])
  expect(s.apps).toHaveLength(5)
  expect(result.type === 'folder' && result.items).toEqual([
    { type: 'app', appId: s.apps[4].id }, { type: 'app', appId: s.apps[4].id }, { type: 'app', appId: 'figma' },
    { type: 'macro', macroId: 'm' }, null, null, null, null
  ])
})
