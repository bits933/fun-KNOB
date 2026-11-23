// ponytail: 75 ms per detent until the hardware detents per turn are measured.
export const DETENT_MS = 75
// ponytail: 350 ms idle until release can be calibrated on the real knob.
export const RELEASE_MS = 350

export class ScratchGesture {
  targetMs = 0
  private deadline: number | null = null

  move(dir: -1 | 1, now: number, oldestMs: number): boolean {
    const first = this.deadline === null
    this.deadline = now + RELEASE_MS
    this.targetMs = Math.max(oldestMs, Math.min(0, this.targetMs + dir * DETENT_MS))
    return first
  }

  idle(now: number): boolean {
    return this.deadline !== null && now >= this.deadline
  }

  reset(): void {
    this.deadline = null
    this.targetMs = 0
  }
}

export function seekAfterScratch(positionMs: number, endMs: number, offsetMs: number): number {
  return Math.max(0, Math.min(endMs, Math.round(positionMs + offsetMs)))
}
