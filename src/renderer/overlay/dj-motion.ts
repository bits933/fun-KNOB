// shortcut: Cadence is inferred from renderer arrivals until hardware timestamps are available.
export const DJ = {
  detentMs: 75,
  initialIntervalMs: 50,
  minIntervalMs: 22,
  maxIntervalMs: 600,
  intervalWeight: 0.35,
  stopIntervals: 1.5,
  // Platter stays held this many intervals after it has stopped before the motor restarts, so a slow turn keeps scrubbing.
  holdIntervals: 0.7,
  rateSlewPerMs: 0.16,
  initialTravelDetents: 0.75,
  initialHoldbackDetents: 0.25,
  coastLimitDetents: 0.4,
  firstIdleMs: 550,
  brakeMs: 42,
  idleMs: 165,
  maxIdleMs: 1100,
  startMs: 250,
  crossfadeMs: 40,
  preRollMs: 230,
  touchFadeMs: 22,
  captureLatencyMs: 70,
  liveOnsetMs: 34,
  loopbackDrainMs: 70,
  nearZeroRate: 0.04
}

export function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

export class PlatterMotion {
  private intervalMs: number | undefined
  private lastAtMs: number | undefined
  private direction: -1 | 1 = -1
  private targetMs = 0

  reset(positionMs: number): void {
    this.targetMs = positionMs
    this.lastAtMs = this.intervalMs = undefined
  }

  detent(dir: -1 | 1, atMs: number, oldestMs: number, startMs: number): void {
    if (this.lastAtMs !== undefined && atMs > this.lastAtMs) {
      const interval = Math.max(DJ.minIntervalMs, Math.min(DJ.maxIntervalMs, atMs - this.lastAtMs))
      this.intervalMs = this.intervalMs === undefined ? interval : this.intervalMs + (interval - this.intervalMs) * DJ.intervalWeight
    }
    this.lastAtMs = atMs
    this.direction = dir
    this.targetMs = Math.max(oldestMs, Math.min(startMs, this.targetMs + dir * DJ.detentMs))
  }

  get idleMs(): number {
    // Give a slow second detent time to establish cadence before restarting the motor.
    if (this.intervalMs === undefined) return DJ.firstIdleMs
    return Math.min(DJ.maxIdleMs, Math.max(DJ.idleMs, this.intervalMs * (DJ.stopIntervals + DJ.holdIntervals)))
  }

  nextRate(positionMs: number, rate: number, ageMs: number, touchMs: number, quantumMs: number): number {
    const interval = this.intervalMs ?? DJ.initialIntervalMs
    // Leave one render quantum for delivery of the next expected detent.
    const stopWindow = (DJ.stopIntervals - 1) * interval
    const grace = Math.min(quantumMs, stopWindow / 2)
    const decay = (ageMs - interval - grace) / (stopWindow - grace)
    const cruise = DJ.detentMs / interval
    // Reserve travel for the unmeasured second detent and bound extrapolation once tracking.
    const limit = this.intervalMs === undefined ? -DJ.initialHoldbackDetents : DJ.coastLimitDetents
    const remaining = Math.max(0, (this.targetMs - positionMs) * this.direction + limit * DJ.detentMs)
    const handRate = this.direction * Math.min(cruise, Math.sqrt(2 * DJ.rateSlewPerMs * remaining))
    const targetRate = 1 + (handRate - 1) * smoothstep(touchMs / DJ.brakeMs)
    const step = DJ.rateSlewPerMs * quantumMs
    const next = rate + Math.max(-step, Math.min(step, targetRate - rate))
    if (decay <= 0) return next
    const stopSpeed = cruise * (1 - smoothstep(decay))
    return this.direction * Math.min(next * this.direction, stopSpeed)
  }
}
