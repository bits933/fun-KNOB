import { expect, it } from 'vitest'
import { DJ, PlatterMotion, smoothstep } from './dj-motion'

function simulate(interval: number, detents: (-1 | 1)[], quantum = 128 / 48) {
  const motion = new PlatterMotion()
  const tickTimes = detents.map((_, i) => Math.floor(i * interval / quantum) * quantum)
  const lastTick = tickTimes.at(-1)!
  let positionMs = -DJ.initialTravelDetents * DJ.detentMs
  let rate = 1
  let lastAt = 0
  let tick = 0
  const curve: { at: number; rate: number; positionMs: number }[] = []
  for (let block = 0; block * quantum < lastTick + DJ.stopIntervals * interval + 2 * quantum; block++) {
    const at = block * quantum
    if (at === tickTimes[tick]) {
      lastAt = at
      motion.detent(detents[tick], tick * interval, -5000, 0)
      tick++
    }
    const nextRate = motion.nextRate(positionMs, rate, at + quantum - lastAt, at + quantum, quantum)
    positionMs += (nextRate + rate) * quantum / 2
    rate = nextRate
    curve.push({ at: at + quantum, rate, positionMs })
  }
  return { curve, tickTimes, lastTick, idleMs: motion.idleMs }
}

it.each([2, 3, 4, 10, 20, 40])('holds rate at %i detents/s and stops within half a detent', hz => {
  const interval = 1000 / hz
  const quantum = 128 / 44.1
  const { curve, lastTick, idleMs } = simulate(interval, Array<-1>(9).fill(-1), quantum)
  const steady = curve.filter(point => point.at >= 2 * interval && point.at <= lastTick)
  const cruise = DJ.detentMs / interval
  expect(steady.length).toBeGreaterThan(0)
  expect(Math.max(...steady.map(point => Math.abs(point.rate + cruise) / cruise))).toBeLessThanOrEqual(0.03)
  expect(idleMs).toBeGreaterThanOrEqual(DJ.stopIntervals * interval)

  const target = -9 * DJ.detentMs
  const stopped = curve.filter(point => point.at >= lastTick + DJ.stopIntervals * interval)
  expect(stopped.every(point => Math.abs(point.rate) < 1e-9)).toBe(true)
  expect(Math.abs(stopped.at(-1)!.positionMs - target)).toBeLessThanOrEqual(DJ.detentMs / 2)
  const slowing = curve.filter(point => point.at >= lastTick + interval)
  expect(slowing.every((point, i) => !i || point.rate >= slowing[i - 1].rate - 1e-9)).toBe(true)
  expect(Math.min(...slowing.map(point => point.positionMs))).toBeGreaterThanOrEqual(target - DJ.detentMs / 2)
})

it('keeps a lone detent within half a step and waits for a slow second detent', () => {
  const { curve, idleMs } = simulate(DJ.initialIntervalMs, [-1])
  const stop = curve.at(-1)!
  expect(Math.abs(stop.rate)).toBe(0)
  expect(Math.abs(stop.positionMs + DJ.detentMs)).toBeLessThanOrEqual(DJ.detentMs / 2)
  expect(idleMs).toBeGreaterThan(DJ.maxIntervalMs * 0.75)
})

it('crosses zero within one reversing interval and settles without reversing again', () => {
  const interval = 24
  const { curve, tickTimes } = simulate(interval, [-1, -1, -1, 1, 1, 1, -1, -1, -1])
  for (const [first, end, dir] of [[3, 6, 1], [6, 9, -1]]) {
    const start = tickTimes[first]
    const segment = curve.filter(point => point.at > start && point.at <= (tickTimes[end] ?? Infinity))
    const crossing = segment.findIndex(point => point.rate * dir > 0)
    expect(crossing).toBeGreaterThanOrEqual(0)
    expect(segment[crossing].at - start).toBeLessThanOrEqual(interval)
    expect(segment.slice(crossing).every(point => point.rate * dir >= -1e-9)).toBe(true)
  }
  expect(Math.abs(curve.at(-1)!.positionMs + 3 * DJ.detentMs)).toBeLessThanOrEqual(DJ.detentMs / 2)
})

it('eases between endpoints with no discontinuity', () => {
  expect([-1, 0, 0.25, 0.5, 0.75, 1, 2].map(smoothstep)).toEqual([0, 0, 0.15625, 0.5, 0.84375, 1, 1])
})

it.each([2, 3])('holds a %i detents/s turn long enough that the motor never restarts between clicks', hz => {
  const motion = new PlatterMotion()
  const interval = 1000 / hz
  for (let i = 0; i < 4; i++) motion.detent(-1, i * interval, -5000, 0)
  // A click up to 1.4x late (hand jitter) must still land before the motor restarts.
  expect(motion.idleMs).toBeGreaterThan(interval * 1.4)
})
