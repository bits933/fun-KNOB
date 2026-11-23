import { useEffect, useRef, useState } from 'react'
import type { Gesture } from '@shared/types'
import { Icon } from '@renderer/icons/Icon'
import { useGestures, api } from '../data'
import { cn } from '../lib/utils'
import { Card, PageHeader } from '../ui'
import type { ScreenProps } from './types'

type Tile = 'rotate-' | 'rotate+' | 'click' | 'double' | 'long' | 'hold'

const TILES: { id: Tile; label: string }[] = [
  { id: 'rotate-', label: 'Rotate left' },
  { id: 'rotate+', label: 'Rotate right' },
  { id: 'click', label: 'Click' },
  { id: 'double', label: 'Double click' },
  { id: 'long', label: 'Long press' },
  { id: 'hold', label: 'Hold + rotate' }
]

const tileOf = (g: Gesture): Tile => (g === 'hold-rotate+' || g === 'hold-rotate-' ? 'hold' : g)
const LIT_MS = 650
const MAX_LOG = 14
const STEP_DEG = 24

interface LogItem { n: number; time: string; name: Gesture }

/** Test: glass knob stage, gesture tiles, and live event log. */
export function Test(_props: ScreenProps): React.JSX.Element {
  const [lit, setLit] = useState<Partial<Record<Tile, boolean>>>({})
  const [angle, setAngle] = useState(0)
  const [log, setLog] = useState<LogItem[]>([])
  const [side, setSide] = useState<'left' | 'right' | null>(null)
  const timers = useRef<Record<string, number>>({})
  const seq = useRef(0)

  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    const sync = (): void => api.setTestMode(!document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      api.setTestMode(false)
    }
  }, [])

  const flash = (key: string, on: () => void, off: () => void): void => {
    window.clearTimeout(timers.current[key])
    on()
    timers.current[key] = window.setTimeout(off, LIT_MS)
  }

  useGestures((g) => {
    const tile = tileOf(g)
    flash(tile, () => setLit((l) => ({ ...l, [tile]: true })), () => setLit((l) => ({ ...l, [tile]: false })))
    if (g.endsWith('+')) {
      setAngle((a) => a + STEP_DEG)
      flash('arrow', () => setSide('right'), () => setSide(null))
    } else if (g.endsWith('-')) {
      setAngle((a) => a - STEP_DEG)
      flash('arrow', () => setSide('left'), () => setSide(null))
    }
    const time = new Date().toLocaleTimeString('en-GB')
    setLog((l) => [...l, { n: ++seq.current, time, name: g }].slice(-MAX_LOG))
  })

  const active = Boolean(lit.click || lit.double || lit.long || lit.hold || side !== null)
  const pressed = Boolean(lit.click || lit.double || lit.long)

  return (
    <>
      <PageHeader title="Test" description="Use the knob. Each gesture lights up." />
      <div className="grid grid-cols-[minmax(0,1fr)_304px] gap-6 flex-1 min-h-0">
        <div className="flex flex-col gap-5 min-h-0">
          <div className="dc-glass flex-1 min-h-0 rounded-[20px] flex items-center justify-center gap-12 relative overflow-hidden">
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute w-96 h-96 rounded-full transition-opacity duration-200 ease-out',
                active ? 'opacity-100' : 'opacity-45'
              )}
              style={{
                background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-solid) 24%, transparent) 0%, transparent 68%)'
              }}
            />
            <span
              className={cn(
                'relative z-10 w-12 h-12 rounded-full border flex items-center justify-center transition-[color,background-color,border-color,transform] ease-out motion-reduce:transform-none',
                side === 'left'
                  ? 'bg-primary/16 border-transparent text-accent-foreground scale-108 duration-100'
                  : 'bg-white/[0.06] border-white/[0.09] text-subtle-foreground duration-200'
              )}
            >
              <Icon name="chevron-left" size={24} />
            </span>
            <div
              className="relative z-10 shrink-0 w-[216px] h-[216px] rounded-full bg-[#12151d] border border-white/[0.065] shadow-[0_18px_42px_rgba(0,0,0,0.55)] flex items-center justify-center"
              aria-hidden="true"
            >
              <div
                className={cn(
                  'relative w-[148px] h-[148px] rounded-full bg-[#0b0d13] border border-white/[0.065] shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition-transform ease-out motion-reduce:transform-none',
                  pressed ? 'scale-95 duration-100' : 'duration-200'
                )}
              >
                <div
                  className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div className="absolute left-1/2 top-3 -translate-x-1/2 w-1.5 h-[24px] rounded-full bg-accent-foreground shadow-[0_0_10px_rgba(127,200,178,0.6)]" />
                </div>
              </div>
            </div>
            <span
              className={cn(
                'relative z-10 w-12 h-12 rounded-full border flex items-center justify-center transition-[color,background-color,border-color,transform] ease-out motion-reduce:transform-none',
                side === 'right'
                  ? 'bg-primary/16 border-transparent text-accent-foreground scale-108 duration-100'
                  : 'bg-white/[0.06] border-white/[0.09] text-subtle-foreground duration-200'
              )}
            >
              <Icon name="chevron-right" size={24} />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TILES.map((t) => (
              <div
                key={t.id}
                data-tile={t.id}
                className={cn(
                  'h-14 px-4 rounded-2xl border flex items-center justify-center text-[13.5px] font-medium tracking-[0.01em] transition-[color,background-color,border-color,transform] ease-out motion-reduce:transform-none',
                  lit[t.id]
                    ? 'bg-primary/16 border-transparent text-accent-foreground scale-[1.02] duration-100'
                    : 'dc-glass text-muted-foreground duration-200'
                )}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>
        <Card
          title="Event log"
          headerRight={
            <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/[0.045] border border-white/[0.07] text-[12.5px] font-medium text-muted-foreground tabular-nums">
              {log.length ? `${log.length} ${log.length === 1 ? 'event' : 'events'}` : 'Waiting'}
            </span>
          }
          className="k-side-theme !bg-[#111111] !border-[#1f1f1f] min-h-0 flex flex-col"
        >
          {log.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center px-4">
              <p className="m-0 text-[13.5px] text-muted-foreground leading-relaxed">Turn or press the knob to inspect gestures.</p>
            </div>
          ) : (
            <ol className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 m-0 p-0 list-none" aria-live="off">
              {log.map((e, i) => (
                <li key={e.n} className="flex items-center gap-3.5 text-[13px] animate-[k-fade-only_var(--dur-base)_var(--ease-out)_both]">
                  <span className="font-mono text-[12.5px] text-subtle-foreground tabular-nums w-[72px] shrink-0">{e.time}</span>
                  <span className={cn('font-mono text-[13.5px] truncate', i === log.length - 1 ? 'text-accent-foreground font-medium' : 'text-muted-foreground')}>
                    {e.name}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
      <p className="text-[13px] text-subtle-foreground m-0">Volume keys are captured while this screen is open.</p>
    </>
  )
}
