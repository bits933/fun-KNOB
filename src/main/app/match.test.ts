import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { matchInstalled } from './match'

describe('matchInstalled', () => {
  const apps = [
    { name: 'Resolve', exePath: join('resolve', 'Resolve.exe'), processName: 'Resolve.exe' },
    ...['5.2', '5.3'].map(v => ({ name: `Blender ${v}`, exePath: join(v, 'blender-launcher.exe'), processName: 'blender-launcher.exe' }))
  ]
  it('matches process names without case sensitivity', () => expect(matchInstalled('resolve.EXE', apps, () => false)).toBe(apps[0].exePath))
  it('chooses the newest named launcher with the process beside it', () => expect(matchInstalled('blender.exe', apps, p => p.endsWith(join('5.2', 'blender.exe')) || p.endsWith(join('5.3', 'blender.exe')))).toBe(apps[2].exePath))
  it('returns null without a match', () => expect(matchInstalled('missing.exe', apps, () => false)).toBeNull())
})
