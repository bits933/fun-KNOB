/**
 * Turns raw knob events into gestures. Port of prd/knob.py (tested on the user's keyboard).
 * Pure: time is passed in (ms, monotonic). Call tick() when nextDeadline() has passed.
 */
import type { Gesture, RawKnobEvent } from '@shared/types'

export interface GestureTiming {
  /** Max wait for a 2nd click. */
  doubleMs: number
  /** Hold time that counts as a long press. */
  longMs: number
  /** Keep hold-rotate going while turns arrive within this gap. */
  chainMs: number
}

export class GestureEngine {
  private held = false
  /** The current press already became a long press or a hold-rotate. */
  private used = false
  private pressT = 0
  /** A click waiting to see if a 2nd one comes. */
  private pendingT: number | null = null
  /**
   * The keyboard reports one media key at a time: turning while held sends a fake Mute
   * release, so the real release is invisible. Turns are chained by timing instead.
   */
  private chainT: number | null = null

  constructor(
    private timing: GestureTiming,
    private readonly emit: (g: Gesture) => void
  ) {}

  setTiming(timing: GestureTiming): void {
    this.timing = timing
  }

  raw(kind: RawKnobEvent['kind'], now: number): void {
    this.tick(now)
    if (kind === 'press') this.press(now)
    else if (kind === 'release') this.release(now)
    else this.rotate(kind === 'cw' ? 1 : -1, now)
  }

  /** Time at which tick() must be called next, or null if nothing is pending. */
  nextDeadline(): number | null {
    if (this.held && !this.used) return this.pressT + this.timing.longMs
    if (this.pendingT !== null && !this.held) return this.pendingT + this.timing.doubleMs
    return null
  }

  tick(now: number): void {
    if (this.held && !this.used && now - this.pressT >= this.timing.longMs) {
      this.flushClick()
      this.used = true
      this.emit('long')
    }
    if (this.pendingT !== null && !this.held && now - this.pendingT >= this.timing.doubleMs) {
      this.flushClick()
    }
  }

  private flushClick(): void {
    if (this.pendingT !== null) {
      this.pendingT = null
      this.emit('click')
    }
  }

  private rotate(dir: 1 | -1, now: number): void {
    const sign = dir > 0 ? '+' : '-'
    if (this.held || (this.chainT !== null && now - this.chainT < this.timing.chainMs)) {
      this.used = this.used || this.held
      this.chainT = now
      this.emit(`hold-rotate${sign}`)
    } else {
      this.flushClick()
      this.emit(`rotate${sign}`)
    }
  }

  private press(now: number): void {
    if (this.held) return // key auto-repeat while holding
    this.held = true
    this.used = false
    this.pressT = now
    this.chainT = null
  }

  private release(_now: number): void {
    if (!this.held) return
    this.held = false
    if (this.used) return
    if (this.pendingT !== null) {
      this.pendingT = null
      this.emit('double')
    } else {
      this.pendingT = _now
    }
  }
}
