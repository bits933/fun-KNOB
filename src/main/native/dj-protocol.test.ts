import { expect, it } from 'vitest'
import { parseMediaLine } from './brightness'

it('parses only well-formed media snapshots and clamps nothing silently', () => {
  expect(parseMediaLine('17 media 123456 240000 1 1795400000000')).toEqual({
    id: 17, value: { positionMs: 123456, endMs: 240000, wasPlaying: true, readAtMs: 1795400000000 }
  })
  expect(parseMediaLine('18 media 0 0 0 1795400000000')).toEqual({
    id: 18, value: { positionMs: 0, endMs: 0, wasPlaying: false, readAtMs: 1795400000000 }
  })
  for (const line of ['error', '1 media -1 200 1 1', '1 media 100 200 2 1', '1 media 1e2 200 1 1', '1 media 100 9007199254740992 1 1', '1 media 100 200 1']) {
    expect(parseMediaLine(line)).toBeNull()
  }
})
