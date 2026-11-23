import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SmoothSliderProps {
  value: number[]
  min?: number
  max?: number
  step?: number
  stops?: boolean
  disabled?: boolean
  'aria-label'?: string
  onValueChange?: (value: number[]) => void
  className?: string
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const snapToStep = (raw: number, min: number, max: number, step: number): number => {
  if (step <= 0) return clamp(raw, min, max)
  const snapped = min + Math.round((raw - min) / step) * step
  return clamp(Number(snapped.toFixed(6)), min, max)
}

/**
 * Capsule pill slider (26 px height) with optional detent stops, magnetic rubber-band snap,
 * subtle velocity stretch, and overscroll edge rubber-banding.
 */
const Slider = React.forwardRef<HTMLDivElement, SmoothSliderProps>(
  ({ value, min = 0, max = 100, step = 1, stops, disabled = false, onValueChange, className, ...aria }, ref) => {
    const innerRef = React.useRef<HTMLDivElement>(null)
    const [dragVal, setDragVal] = React.useState<number | null>(null)
    const [overflow, setOverflow] = React.useState(0)
    const [vel, setVel] = React.useState(0)
    const [reducedMotion, setReducedMotion] = React.useState(false)
    const lastClientX = React.useRef<number | null>(null)
    const velTimer = React.useRef<number | null>(null)
    const lastEmitted = React.useRef<number>(value[0] ?? min)
    const dragging = dragVal !== null

    React.useEffect(() => {
      if (typeof window === 'undefined' || !window.matchMedia) return
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReducedMotion(mq.matches)
      const onChangeMq = (e: MediaQueryListEvent): void => setReducedMotion(e.matches)
      mq.addEventListener('change', onChangeMq)
      return () => mq.removeEventListener('change', onChangeMq)
    }, [])

    React.useEffect(
      () => () => {
        if (velTimer.current !== null) window.clearTimeout(velTimer.current)
      },
      []
    )

    const committed = clamp(value[0] ?? min, min, max)
    lastEmitted.current = committed

    const span = max - min
    const stopCount = step > 0 ? Math.round(span / step) : 0
    const hasStops = stops ?? (stopCount >= 2 && stopCount <= 10)

    let shown = committed
    let thumbScaleX = 1
    let thumbScaleY = 1

    if (dragging) {
      if (hasStops && step > 0) {
        const u = (dragVal - min) / step
        const nearest = Math.round(u)
        const dist = u - nearest
        const visualU = nearest + dist * (0.72 + 0.28 * Math.pow(Math.min(1, Math.abs(dist) * 2), 1.6))
        shown = clamp(min + visualU * step, min, max)
        if (!reducedMotion) {
          const tension = Math.min(1, Math.abs(dist) * 2)
          thumbScaleX = 1 + tension * 0.14
          thumbScaleY = 1 - tension * 0.05
        }
      } else {
        shown = dragVal
        if (!reducedMotion) {
          thumbScaleX = 1 + clamp(Math.abs(vel) / 28, 0, 0.08)
          thumbScaleY = 1 - clamp(Math.abs(vel) / 40, 0, 0.04)
        }
      }
    }

    const pct = span > 0 ? clamp(((shown - min) / span) * 100, 0, 100) : 0
    const t = clamp(pct / 100, 0, 1)

    const updateFromClientX = (clientX: number, trackVelocity: boolean): void => {
      const innerRect = innerRef.current?.getBoundingClientRect()
      if (!innerRect || innerRect.width <= 0 || span <= 0) {
        setDragVal(committed)
        setOverflow(0)
        return
      }
      const ratio = (clientX - (innerRect.left + 5)) / Math.max(1, innerRect.width - 10)
      const clampedRatio = clamp(ratio, 0, 1)
      const raw = min + clampedRatio * span
      const rawOverflow = ratio < 0 ? ratio : ratio > 1 ? ratio - 1 : 0
      const overVal = rawOverflow !== 0 ? Math.tanh(rawOverflow * 1.4) : 0

      setOverflow(overVal)
      setDragVal(raw)

      if (trackVelocity && !hasStops) {
        const dx = lastClientX.current !== null ? clientX - lastClientX.current : 0
        lastClientX.current = clientX
        setVel(dx)
        if (velTimer.current !== null) window.clearTimeout(velTimer.current)
        velTimer.current = window.setTimeout(() => setVel(0), 60)
      }

      const snapped = snapToStep(raw, min, max, step)
      if (snapped !== lastEmitted.current) {
        lastEmitted.current = snapped
        onValueChange?.([snapped])
      }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      lastClientX.current = e.clientX
      setVel(0)
      updateFromClientX(e.clientX, false)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragging || disabled) return
      updateFromClientX(e.clientX, true)
    }

    const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragging) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (velTimer.current !== null) {
        window.clearTimeout(velTimer.current)
        velTimer.current = null
      }
      lastClientX.current = null
      setVel(0)
      setOverflow(0)
      setDragVal(null)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const big = Math.max(step, span / 10)
      let next: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = committed + step
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = committed - step
      else if (e.key === 'PageUp') next = committed + big
      else if (e.key === 'PageDown') next = committed - big
      else if (e.key === 'Home') next = min
      else if (e.key === 'End') next = max
      if (next === null) return
      e.preventDefault()
      const snapped = snapToStep(next, min, max, step)
      if (snapped !== committed) onValueChange?.([snapped])
    }

    const over = reducedMotion ? 0 : overflow
    const outerStyle: React.CSSProperties | undefined =
      over !== 0
        ? {
            transform: `translateX(${(over * 3.5).toFixed(2)}px) scaleX(${(1 + Math.abs(over) * 0.028).toFixed(4)}) scaleY(${(1 - Math.abs(over) * 0.032).toFixed(4)})`,
            transformOrigin: over < 0 ? 'right center' : 'left center'
          }
        : undefined

    return (
      <div
        ref={ref}
        data-disabled={disabled ? '' : undefined}
        style={outerStyle}
        className={cn(
          'relative flex w-full h-[26px] items-center rounded-full bg-[#15181b] border border-white/[0.09] p-[3px] touch-none select-none cursor-pointer data-[disabled]:opacity-45 data-[disabled]:cursor-not-allowed',
          dragging && over !== 0
            ? 'transition-none'
            : 'transition-transform duration-[220ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none',
          className
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={innerRef} className="relative h-[20px] w-full rounded-full">
          <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
            {hasStops &&
              Array.from({ length: Math.max(0, stopCount - 1) }, (_, idx) => {
                const k = idx + 1
                const frac = k / stopCount
                return (
                  <span
                    key={k}
                    data-slider-tick=""
                    aria-hidden="true"
                    style={{ left: `calc(5px + (100% - 10px) * ${frac})` }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[12px] rounded-full bg-white/[0.09] pointer-events-none z-0"
                  />
                )
              })}
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 rounded-full z-10 pointer-events-none',
                dragging
                  ? 'transition-none'
                  : hasStops
                    ? 'transition-[width] duration-[220ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] motion-reduce:transition-none'
                    : 'transition-[width] duration-[180ms] ease-[cubic-bezier(0.22,1.2,0.36,1)] motion-reduce:transition-none'
              )}
              style={{
                width: `calc(10px + (100% - 10px) * ${t})`,
                background: 'linear-gradient(90deg, #327060 0%, #2a6357 55%, #24584e 100%)'
              }}
            />
          </div>
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={aria['aria-label']}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={committed}
            aria-disabled={disabled || undefined}
            data-dragging={dragging ? 'true' : undefined}
            data-has-stops={hasStops ? 'true' : undefined}
            data-pct={pct.toFixed(2)}
            onKeyDown={onKeyDown}
            style={{
              left: `calc(5px + (100% - 10px) * ${t})`,
              transform: `scale(${thumbScaleX.toFixed(4)}, ${thumbScaleY.toFixed(4)})`
            }}
            className={cn(
              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[10px] h-[20px] rounded-full bg-[#dcdedf] hover:bg-[#e8eaec] shadow-[0_1px_3px_rgba(0,0,0,0.45)] focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-2',
              dragging
                ? !hasStops
                  ? 'transition-transform duration-100 ease-out motion-reduce:transition-none'
                  : 'transition-none'
                : hasStops
                  ? 'transition-[left,transform,background-color] duration-[220ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] motion-reduce:transition-none'
                  : 'transition-[left,transform,background-color] duration-[180ms] ease-[cubic-bezier(0.22,1.2,0.36,1)] motion-reduce:transition-none'
            )}
          />
        </div>
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }
