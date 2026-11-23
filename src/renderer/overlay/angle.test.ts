import { describe, expect, it } from 'vitest'
import { nextAngle } from './angle'

describe('nextAngle', () => {
  it('moves one step forward from 7 to 0', () => expect(nextAngle(315, 0)).toBe(360))
  it('moves one step back from 0 to 7', () => expect(nextAngle(0, 7)).toBe(-45))
  it('keeps accumulating over several laps', () => {
    let a = 0
    for (let i = 1; i <= 17; i++) a = nextAngle(a, i % 8)
    expect(a).toBe(17 * 45)
  })
  it('retargets from a mid-glide angle by the shortest way', () => expect(nextAngle(100, 0)).toBe(0))
  it('follows the knob over empty slots: ccw from 0 to 3 when 4-7 are empty', () =>
    expect(nextAngle(0, 3, [true, true, true, true, false, false, false, false])).toBe(-225))
  it('cw from 3 to 0 over the same empty slots', () =>
    expect(nextAngle(135, 0, [true, true, true, true, false, false, false, false])).toBe(360))
  it('adjacent filled slots still take one step', () =>
    expect(nextAngle(0, 1, [true, true, true, true, false, false, false, false])).toBe(45))
})

for (const n of [4, 5]) it(`wraps ${n} equally spaced slots`, () => {
 const filled = Array(n).fill(true), step = 360 / n
 expect(nextAngle(360 - step, 0, filled)).toBe(360)
 expect(nextAngle(0, n - 1, filled)).toBe(-step)
})
