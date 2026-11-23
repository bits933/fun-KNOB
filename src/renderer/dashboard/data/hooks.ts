import { useEffect, useRef, useState } from 'react'
import type { AppStatus, DialView, Gesture, Readout, Settings } from '@shared/types'
import { api } from './api'
import { createHistory } from './history'

const history = createHistory<Settings>()

/** Undo/redo over settings edits made through update(). */
export function useHistory(): { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void } {
  const [state, setState] = useState({ canUndo: history.canUndo, canRedo: history.canRedo })
  useEffect(() => {
    shared.start()
    const refresh = (): void => setState({ canUndo: history.canUndo, canRedo: history.canRedo })
    shared.historySubs.add(refresh)
    refresh()
    return () => void shared.historySubs.delete(refresh)
  }, [])
  return { ...state, undo: shared.undo, redo: shared.redo }
}

/**
 * Settings: `settings` is null until the first load. `update(fn)` clones the current settings, lets `fn` edit the
 * copy (mutate it, or return a new object), shows the result at once and sends it with `setSettings`.
 * `update(s => { s.general.dialSizePercent = 90 })`
 */
export function useSettings(): { settings: Settings | null; update: (fn: (draft: Settings) => Settings | void) => Promise<void> } {
  const [settings, setSettings] = useState<Settings | null>(shared.current)
  useEffect(() => {
    shared.start()
    shared.subs.add(setSettings)
    setSettings(shared.current)
    return () => void shared.subs.delete(setSettings)
  }, [])
  return { settings, update: shared.update }
}

/**
 * One settings state for every useSettings() in the window. Each edit applies to the newest local
 * value, and edits are sent to main one after another, so two quick edits from different screens
 * can't overwrite each other. Broadcasts from main are ignored while our own edits are in flight
 * (they are only echoes). A failed save reloads the real settings from main.
 */
const shared = {
  current: null as Settings | null,
  subs: new Set<(s: Settings) => void>(),
  historySubs: new Set<() => void>(),
  notifyHistory(): void {
    shared.historySubs.forEach(f => f())
  },
  started: false,
  pending: 0,
  chain: Promise.resolve() as Promise<unknown>,
  set(s: Settings): void {
    shared.current = s
    shared.subs.forEach((f) => f(s))
  },
  start(): void {
    if (shared.started) return
    shared.started = true
    void api.getSettings().then((s) => { if (!shared.current) shared.set(s) })
    api.onSettings((s) => { if (shared.pending === 0) shared.set(s) })
  },
  async update(fn: (draft: Settings) => Settings | void): Promise<void> {
    if (!shared.current) return
    const draft = structuredClone(shared.current)
    const next = fn(draft) ?? draft
    const changed = history.record(shared.current, next)
    shared.notifyHistory()
    if (changed) await shared.save(next)
  },
  undo(): void {
    if (!shared.current) return
    const next = history.undo(shared.current)
    shared.notifyHistory()
    if (next) void shared.save(next)
  },
  redo(): void {
    if (!shared.current) return
    const next = history.redo(shared.current)
    shared.notifyHistory()
    if (next) void shared.save(next)
  },
  async save(next: Settings): Promise<void> {
    shared.set(next)
    shared.pending++
    const send = shared.chain.then(() => api.setSettings(next))
    shared.chain = send.catch(() => {})
    try {
      await send
    } catch (e) {
      console.error('Saving settings failed', e)
      history.clear()
      shared.notifyHistory()
      shared.set(await api.getSettings())
      history.clear()
      shared.notifyHistory()
    } finally {
      shared.pending--
    }
  }
}

/** Live app status (null until loaded). */
export function useStatus(): AppStatus | null {
  const [status, setStatus] = useState<AppStatus | null>(null)
  useEffect(() => {
    let alive = true
    void api.getStatus().then((s) => alive && setStatus(s))
    const off = api.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

/** The main dial as the overlay would draw it (null until loaded). */
export function useDialView(): DialView | null {
  const [view, setView] = useState<DialView | null>(null)
  useEffect(() => {
    let alive = true
    void api.getDialView().then((v) => alive && setView(v))
    const off = api.onDialView(setView)
    return () => {
      alive = false
      off()
    }
  }, [])
  return view
}

/** The last readout the knob produced (null before the first one or after it was hidden). */
export function useReadout(): Readout | null {
  const [readout, setReadout] = useState<Readout | null>(null)
  useEffect(() => api.onReadout(setReadout), [])
  return readout
}

/** Calls `cb` for every knob gesture while mounted (the callback may change between renders). */
export function useGestures(cb: (g: Gesture) => void): void {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => api.onGesture((g) => ref.current(g)), [])
}
