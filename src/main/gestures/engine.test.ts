import { describe, expect, it } from 'vitest'
import type { Gesture } from '@shared/types'
import { GestureEngine } from './engine'

type Step = [t: number, action: 'p' | 'r' | '+' | '-' | '.']

function run(...steps: Step[]): Gesture[] {
  const out: Gesture[] = []
  const g = new GestureEngine({ doubleMs: 300, longMs: 500, chainMs: 600 }, (x) => out.push(x))
  for (const [t, a] of steps) {
    if (a === '.') g.tick(t)
    else g.raw(a === 'p' ? 'press' : a === 'r' ? 'release' : a === '+' ? 'cw' : 'ccw', t)
  }
  return out
}

describe('GestureEngine (same cases as prd/knob.py)', () => {
  it('rotates', () => expect(run([0, '+'], [100, '-'])).toEqual(['rotate+', 'rotate-']))
  it('single click after the double-click window', () =>
    expect(run([0, 'p'], [100, 'r'], [1000, '.'])).toEqual(['click']))
  it('double click', () =>
    expect(run([0, 'p'], [100, 'r'], [200, 'p'], [300, 'r'], [1000, '.'])).toEqual(['double']))
  it('long press', () => expect(run([0, 'p'], [600, '.'], [700, 'r'], [2000, '.'])).toEqual(['long']))
  it('hold + rotate', () =>
    expect(run([0, 'p'], [100, '+'], [900, 'r'], [2000, '.'])).toEqual(['hold-rotate+']))
  it('a pending click is flushed before a rotate', () =>
    expect(run([0, 'p'], [100, 'r'], [200, '+'])).toEqual(['click', 'rotate+']))
  it('ignores key auto-repeat while held', () =>
    expect(run([0, 'p'], [50, 'p'], [100, 'r'], [1000, '.'])).toEqual(['click']))
  it('hold-rotate survives the fake release and ends after a pause', () =>
    expect(run([0, 'p'], [100, '+'], [150, 'r'], [300, '+'], [500, '-'], [1500, '+'])).toEqual([
      'hold-rotate+', 'hold-rotate+', 'hold-rotate-', 'rotate+'
    ]))
  it('ignores a release with no press', () => expect(run([0, 'r'], [1000, '.'])).toEqual([]))
})

describe('nextDeadline', () => {
  it('reports when tick is needed', () => {
    const g = new GestureEngine({ doubleMs: 300, longMs: 500, chainMs: 600 }, () => {})
    expect(g.nextDeadline()).toBeNull()
    g.raw('press', 0)
    expect(g.nextDeadline()).toBe(500)
    g.raw('release', 100)
    expect(g.nextDeadline()).toBe(400)
    g.tick(400)
    expect(g.nextDeadline()).toBeNull()
  })
})
