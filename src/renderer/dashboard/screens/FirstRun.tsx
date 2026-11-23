import { useEffect, useRef, useState } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import { useGestures, useSettings, useStatus } from '../data'
import { cn } from '../lib/utils'
import { Button, Card } from '../ui'
import { appSlot, removeRefs } from './helpers'
import { queryParam } from './parts'
import type { ScreenProps } from './types'

const BLURB: Record<string, string> = {
  resolve: 'Video editing',
  figma: 'Interface design',
  photoshop: 'Image editing',
  blender: '3D and animation'
}

type Step = 1 | 2 | 3

/**
 * First run, three steps: turn the knob, click it, tick the apps you have.
 */
export function FirstRun({ navigate, toast }: ScreenProps): React.JSX.Element {
  const { settings, update } = useSettings()
  const status = useStatus()
  const [step, setStep] = useState<Step>(() => {
    const n = Number(queryParam('step'))
    return n === 2 || n === 3 ? n : 1
  })
  const [turned, setTurned] = useState(false)
  const [angle, setAngle] = useState(0)
  const [lit, setLit] = useState<'l' | 'r' | null>(null)
  const [pressed, setPressed] = useState(false)
  const [chosen, setChosen] = useState<Set<string> | null>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const turn = (dir: 1 | -1): void => {
    if (step !== 1) return
    setAngle((a) => a + dir * 30)
    setLit(dir === 1 ? 'r' : 'l')
    later(() => setLit(null), 260)
    if (!turned) {
      setTurned(true)
      later(() => setStep(2), 1300)
    }
  }
  const press = (): void => {
    if (step !== 2 || pressed) return
    setPressed(true)
    later(() => setStep(3), 750)
  }
  useGestures((g) => {
    if (g === 'rotate+') turn(1)
    else if (g === 'rotate-') turn(-1)
    else if (g === 'click') press()
  })

  const apps = settings?.apps ?? []
  const ticked = chosen ?? new Set(apps.filter((a) => status?.appAvailability[a.id] !== false).map((a) => a.id))
  const toggle = (id: string): void => {
    const n = new Set(ticked)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setChosen(n)
  }

  const finish = (withApps: boolean): void => {
    void update((s) => {
      s.general.firstRunDone = true
      if (withApps) for (const a of s.apps) if (!ticked.has(a.id)) removeRefs(s, { appId: a.id })
    })
    toast(withApps ? 'All set' : 'Skipped setup')
    navigate('main-dial')
  }

  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <Card className="w-full max-w-[700px] min-h-[540px] max-h-full p-10 flex flex-col justify-between gap-7 rounded-[24px]">
        <div className="flex items-center justify-center gap-2.5" role="img" aria-label={`Step ${step} of 3`}>
          {([1, 2, 3] as Step[]).map((n) => (
            <span
              key={n}
              data-state={n === step ? 'now' : n < step ? 'done' : 'todo'}
              className={cn(
                'h-2.5 rounded-full transition-all duration-200 ease-out motion-reduce:transition-none',
                n === step ? 'w-8 bg-accent-foreground' : n < step ? 'w-2.5 bg-primary/70' : 'w-2.5 bg-white/[0.12]'
              )}
            />
          ))}
        </div>

        <div
          key={step}
          className="flex-1 flex flex-col items-center justify-center gap-7 min-h-0 w-full animate-[screen-in_var(--dur-base)_var(--ease-out)_both] motion-reduce:animate-[k-fade-only_var(--dur-base)_var(--ease-out)_both]"
        >
          {step === 1 && (
            <>
              <Title title="Turn the knob" text="Turn it left or right to start." />
              <div className="flex items-center gap-10">
                <button
                  type="button"
                  aria-label="Turn left"
                  onClick={() => turn(-1)}
                  className={cn(
                    'w-12 h-12 rounded-full border flex items-center justify-center transition-[color,background-color,border-color,transform] ease-out cursor-pointer focus-visible:outline-none focus-visible:border-active-border motion-reduce:transform-none',
                    lit === 'l'
                      ? 'bg-primary/16 border-transparent text-accent-foreground scale-110 duration-100'
                      : 'bg-white/[0.06] border-white/[0.10] text-subtle-foreground hover:bg-white/[0.11] hover:text-foreground duration-200'
                  )}
                >
                  <Icon name="chevron-left" size={22} />
                </button>
                <div
                  className="relative w-[190px] h-[190px] rounded-full bg-[#12151d] border border-white/[0.065] shadow-[0_18px_42px_rgba(0,0,0,0.55)] flex items-center justify-center"
                  aria-hidden="true"
                >
                  <div
                    className="relative w-[128px] h-[128px] rounded-full bg-[#0b0d13] border border-white/[0.065] shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span className="absolute left-1/2 top-2.5 -translate-x-1/2 w-1.5 h-5 rounded-full bg-accent-foreground" />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Turn right"
                  onClick={() => turn(1)}
                  className={cn(
                    'w-12 h-12 rounded-full border flex items-center justify-center transition-[color,background-color,border-color,transform] ease-out cursor-pointer focus-visible:outline-none focus-visible:border-active-border motion-reduce:transform-none',
                    lit === 'r'
                      ? 'bg-primary/16 border-transparent text-accent-foreground scale-110 duration-100'
                      : 'bg-white/[0.06] border-white/[0.10] text-subtle-foreground hover:bg-white/[0.11] hover:text-foreground duration-200'
                  )}
                >
                  <Icon name="chevron-right" size={22} />
                </button>
              </div>
              <p
                className={cn(
                  'm-0 min-h-[26px] flex items-center gap-2.5 text-[14.5px] text-accent-foreground',
                  turned && 'animate-[k-fade-only_var(--dur-base)_var(--ease-out)_both]'
                )}
                role="status"
              >
                {turned && (
                  <>
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                      <Icon name="check" size={14} />
                    </span>
                    <span>Got it, the knob turns.</span>
                  </>
                )}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <Title
                title="Now click it"
                text={`Click once. We'll wait ${((settings?.gestures.doubleClickMs ?? 300) / 1000).toFixed(1)} s to tell clicks from double clicks.`}
              />
              <button
                type="button"
                className={cn(
                  'fr__press cursor-pointer focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-2',
                  pressed && 'fr__press--down'
                )}
                aria-label="Click the knob"
                onClick={press}
              >
                <span className="fr__ring fr__ring--out" />
                <span className="fr__ring fr__ring--in" />
                <span className="fr__knob2 bg-[#12151d] border border-white/[0.065] shadow-[0_18px_42px_rgba(0,0,0,0.55)]">
                  <span className="fr__cap2 bg-[#0b0d13] border border-white/[0.065] shadow-[0_4px_12px_rgba(0,0,0,0.55)]"><span className="fr__ind" /></span>
                </span>
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <Title title="Which apps do you use?" text="Tick the apps you have. You can change this later." />
              <div className="w-full flex flex-col gap-2.5 overflow-y-auto max-h-[296px] pr-1" role="group" aria-label="Apps">
                {apps.map((a) => {
                  const on = ticked.has(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(a.id)}
                      className={cn(
                        'w-full flex items-center gap-4 min-h-[66px] px-5 py-3 rounded-2xl border text-left transition-[background-color,border-color] duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:border-active-border',
                        on
                          ? 'border-transparent bg-primary/14'
                          : 'bg-[#0b0e14] border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.11]'
                      )}
                    >
                      <span className="flex items-center justify-center shrink-0 w-9 h-9 bg-transparent border-0">
                        <SlotIcon slot={appSlot(a)} size={24} />
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-medium text-foreground truncate">{a.name}</span>
                        <span className="text-[13px] text-muted-foreground truncate">{BLURB[a.id] ?? 'Custom app'}</span>
                      </span>
                      <span
                        className={cn(
                          'flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-opacity duration-150',
                          on ? 'opacity-100 border-0 bg-primary/24 text-accent-foreground' : 'opacity-0'
                        )}
                        aria-hidden="true"
                      >
                        <Icon name="check" size={16} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => finish(false)}>Skip</Button>
          {step === 3 && <Button variant="primary" onClick={() => finish(true)}>Finish</Button>}
        </div>
      </Card>
    </div>
  )
}

function Title({ title, text }: { title: string; text: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <h1 className="m-0 text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-foreground">{title}</h1>
      <p className="m-0 text-[15px] leading-relaxed text-muted-foreground max-w-[460px]">{text}</p>
    </div>
  )
}
