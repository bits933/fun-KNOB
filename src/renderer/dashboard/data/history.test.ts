import { describe, expect, it } from 'vitest'
import { createHistory } from './history'

describe('settings history', () => {
  it('records changes, undoes and redoes in order, and stops at empty stacks', () => {
    let time = 0
    const h = createHistory<number>(() => time)
    expect(h.canUndo).toBe(false)
    expect(h.undo(0)).toBeUndefined()
    expect(h.redo(0)).toBeUndefined()
    h.record(0, 1)
    time = 400
    h.record(1, 2)
    expect(h.undo(2)).toBe(1)
    expect(h.undo(1)).toBe(0)
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(true)
    expect(h.redo(0)).toBe(1)
    expect(h.redo(1)).toBe(2)
    expect(h.canRedo).toBe(false)
  })

  it('coalesces successive drag ticks using time since the last edit', () => {
    let time = 0
    const h = createHistory<number>(() => time)
    h.record(0, 1)
    time = 300
    h.record(1, 2)
    time = 600
    h.record(2, 3)
    time = 1000
    h.record(3, 4)
    expect(h.undo(4)).toBe(3)
    expect(h.undo(3)).toBe(0)
    expect(h.redo(0)).toBe(3)
    expect(h.redo(3)).toBe(4)
  })

  it('ignores equal data, including reordered object keys', () => {
    const h = createHistory<{ a: number; b: number[] }>()
    expect(h.record({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(false)
    expect(h.canUndo).toBe(false)
    expect(h.record({ a: 1, b: [2] }, { a: 1, b: [3] })).toBe(true)
    expect(h.canUndo).toBe(true)
  })

  it('clears redo on a new update and starts a new group after undo/redo', () => {
    const h = createHistory<number>(() => 0)
    h.record(0, 1)
    expect(h.undo(1)).toBe(0)
    expect(h.redo(0)).toBe(1)
    h.record(1, 2)
    expect(h.undo(2)).toBe(1)
    h.record(1, 3)
    expect(h.canRedo).toBe(false)
    expect(h.undo(3)).toBe(1)
    h.record(1, 1)
    expect(h.canRedo).toBe(false)
    expect(h.undo(1)).toBe(0)
  })

  it('owns snapshots and clears both stacks and the coalescing window on reload', () => {
    const h = createHistory<{ values: number[] }>(() => 0)
    const before = { values: [0] }, after = { values: [1] }
    h.record(before, after)
    before.values[0] = 99
    expect(h.undo(after)).toEqual({ values: [0] })
    after.values[0] = 99
    expect(h.redo({ values: [0] })).toEqual({ values: [1] })
    h.clear()
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
    h.record({ values: [5] }, { values: [6] })
    expect(h.undo({ values: [6] })).toEqual({ values: [5] })
  })

  it('retains at most 100 undo steps', () => {
    let time = 0
    const h = createHistory<number>(() => time)
    for (let i = 0; i < 105; i++) {
      time += 400
      h.record(i, i + 1)
    }
    for (let i = 104; i >= 5; i--) expect(h.undo(i + 1)).toBe(i)
    expect(h.canUndo).toBe(false)
    expect(h.undo(5)).toBeUndefined()
  })
})
