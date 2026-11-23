import { DJ, PlatterMotion, smoothstep } from './dj-motion'

declare const sampleRate: number
declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void

type Command = { type: 'detent'; dir: -1 | 1; atMs: number } | { type: 'handoff' }
const HISTORY_SECONDS = 12

class DjWorklet extends AudioWorkletProcessor {
  private readonly size = Math.ceil(HISTORY_SECONDS * sampleRate)
  private readonly ring = [new Float32Array(this.size), new Float32Array(this.size)]
  private readonly trace: boolean
  private readonly framesPerMs = sampleRate / 1000
  private readonly motion = new PlatterMotion()
  private written = 0
  private touch: number | null = null
  private needle = 0
  private rate = 0
  private touchedAt = 0
  private lastDetentAt = 0
  private restart: { at: number; rate: number } | undefined
  private requestedAt = 0
  private fadeAt = Infinity
  private drainUntil = 0

  constructor(options?: AudioWorkletNodeOptions) {
    super()
    this.trace = options?.processorOptions?.trace === true
    this.port.onmessage = ({ data }: MessageEvent<Command>) => {
      if (data.type === 'handoff' && this.requestedAt) {
        // The external player comes in at its own volume. Fade the buffered side across its onset.
        this.fadeAt = Math.max(currentFrame, this.requestedAt + DJ.liveOnsetMs * this.framesPerMs)
      } else if (data.type === 'detent') this.detent(data.dir, data.atMs)
    }
  }

  private detent(dir: -1 | 1, atMs: number): void {
    if (this.requestedAt || currentFrame < this.drainUntil) return
    const start = this.written - 1 - DJ.preRollMs * this.framesPerMs
    const oldest = Math.max(0, this.written - this.size)
    if (this.touch === null) {
      // A forward-only nudge has no new audio to scratch.
      if (dir > 0 || start < 0) return
      this.touch = this.written - 1
      // Keep enough forward audio for the motor ramp and for the player to resume.
      this.motion.reset(start / this.framesPerMs)
      // Advance into the first step while the touch fade is still silent to offset the brake lag.
      this.needle = Math.max(oldest, start - DJ.detentMs * DJ.initialTravelDetents * this.framesPerMs)
      this.rate = 1
      this.touchedAt = currentFrame
      this.port.postMessage({ type: 'touch' })
    } else if (this.restart) {
      this.motion.reset(this.needle / this.framesPerMs)
      this.restart = undefined
    }
    this.lastDetentAt = currentFrame
    this.motion.detent(dir, atMs, oldest / this.framesPerMs, start / this.framesPerMs)
    if (this.trace) this.port.postMessage({ type: 'detent', frame: currentFrame })
  }

  process([input]: Float32Array[][], [output]: Float32Array[][]): boolean {
    if (currentFrame < this.drainUntil) return true
    if (this.touch === null) {
      if (input?.[0]) {
        const [left, right = left] = input
        for (let i = 0; i < left.length; i++) {
          const index = this.written++ % this.size
          this.ring[0][index] = left[i]
          this.ring[1][index] = right[i]
        }
      }
      return true
    }

    const frames = output[0].length
    const endFrame = currentFrame + frames
    const oldest = Math.max(0, this.written - this.size)
    const touchMs = (endFrame - this.touchedAt) / this.framesPerMs
    if (!this.restart && currentFrame - this.lastDetentAt >= this.motion.idleMs * this.framesPerMs) {
      this.restart = { at: currentFrame, rate: this.rate }
      if (this.trace) this.port.postMessage({ type: 'restart', frame: currentFrame })
    }

    const restart = this.restart
    const startProgress = restart ? smoothstep((endFrame - restart.at) / (DJ.startMs * this.framesPerMs)) : 0
    const nextRate = restart ? restart.rate + (1 - restart.rate) * startProgress : this.motion.nextRate(
      this.needle / this.framesPerMs, this.rate, (endFrame - this.lastDetentAt) / this.framesPerMs, touchMs, frames / this.framesPerMs
    )
    const rateStep = (nextRate - this.rate) / frames

    for (let i = 0; i < frames; i++) {
      const frame = currentFrame + i
      this.rate += rateStep
      this.needle = Math.max(oldest, Math.min(this.touch, this.needle + this.rate))
      const gain = smoothstep((frame - this.touchedAt) / (DJ.touchFadeMs * this.framesPerMs))
        * smoothstep(Math.abs(this.rate) / DJ.nearZeroRate)
        * (1 - smoothstep((frame - this.fadeAt) / (DJ.crossfadeMs * this.framesPerMs)))
        * smoothstep((this.touch - this.needle) / (DJ.touchFadeMs * this.framesPerMs))
      const index = Math.floor(this.needle)
      const t = this.needle - index
      const a = Math.max(oldest, index - 1) % this.size
      const b = index % this.size
      const c = Math.min(this.touch, index + 1) % this.size
      const d = Math.min(this.touch, index + 2) % this.size
      for (let ch = 0; ch < output.length; ch++) {
        const samples = this.ring[ch]
        const p = samples[b], q = samples[c]
        const m = (q - samples[a]) * 0.5, n = (samples[d] - p) * 0.5
        output[ch][i] = gain * (p + t * (m + t * (3 * (q - p) - 2 * m - n + t * (2 * (p - q) + m + n))))
      }
    }

    if (this.trace) this.port.postMessage({
      type: 'rate', frame: endFrame, rate: this.rate, needle: this.needle, touch: this.touch
    })
    if (startProgress === 1 && !this.requestedAt) {
      this.requestedAt = endFrame
      this.port.postMessage({
        type: 'release',
        offsetMs: (this.needle - this.touch) / this.framesPerMs - DJ.captureLatencyMs + DJ.liveOnsetMs
      })
    }
    if (currentFrame >= this.fadeAt + DJ.crossfadeMs * this.framesPerMs) {
      this.touch = null
      this.restart = undefined
      this.requestedAt = 0
      this.fadeAt = Infinity
      this.written = 0
      this.drainUntil = endFrame + DJ.loopbackDrainMs * this.framesPerMs
    }
    return true
  }
}

registerProcessor('kreo-dj', DjWorklet)
