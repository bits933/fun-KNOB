import { expect, it } from 'vitest'
import { DETENT_MS, RELEASE_MS, ScratchGesture, seekAfterScratch } from './dj'

it('touches once, clamps to heard audio, and counts idle from the last detent', () => {
  const scratch = new ScratchGesture()
  expect(scratch.move(1, 0, -100)).toBe(true)
  expect(scratch.targetMs).toBe(0)
  expect(scratch.move(-1, 20, -100)).toBe(false)
  expect(scratch.targetMs).toBe(-DETENT_MS)
  scratch.move(-1, 40, -100)
  expect(scratch.targetMs).toBe(-100)
  scratch.move(1, 60, -100)
  expect(scratch.targetMs).toBe(-100 + DETENT_MS)
  expect(scratch.idle(59 + RELEASE_MS)).toBe(false)
  expect(scratch.idle(60 + RELEASE_MS)).toBe(true)
  scratch.reset()
  expect(scratch.idle(1000)).toBe(false)
  expect(scratch.move(-1, 1000, -100)).toBe(true)
})

it('seeks by the needle offset and keeps the result inside the track', () => {
  expect(seekAfterScratch(700, 1000, -125.4)).toBe(575)
  expect(seekAfterScratch(70, 1000, -125)).toBe(0)
  expect(seekAfterScratch(980, 1000, 125)).toBe(1000)
})
