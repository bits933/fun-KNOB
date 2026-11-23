// Entry point. Owner: orchestrator. Wires native → gestures → dial → actions → windows.
import { existsSync } from 'node:fs'
import { listInstalledApps } from './app/installed'
import { getAppIcon } from './app/icons'
import { matchInstalled } from './app/match'
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { app, shell } from 'electron'
import { IPC } from '@shared/api'
import { defaultSettings, SYSTEM_META } from '@shared/defaults'
import type { AppStatus, DialEffect, DialView, Readout, Settings } from '@shared/types'
import { createNative } from './native'
import { createSettingsStore, exportSettings, importSettings, validate } from './settings'
import { GestureEngine } from './gestures/engine'
import { createDialController } from './dial/controller'
import { createActions } from './actions'
import { createDj } from './app/dj'
import { createDashboardWindow, createOverlayWindow, placeOverlay, showDashboard } from './app/windows'
import { createTray, updateTray } from './app/tray'
import { ensureSingleInstance, getStartWithWindows, setStartWithWindows } from './app/system'
import { push, registerIpc } from './app/ipc'

const now = (): number => performance.now()

function launchApp(exePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, [], { cwd: dirname(exePath), detached: true, stdio: 'ignore' })
    child.once('spawn', () => { child.unref(); resolve() })
    child.once('error', reject)
  })
}

async function openTarget(target: string): Promise<void> {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return shell.openExternal(target)
  const err = await shell.openPath(target)
  if (err) throw new Error(err)
}

function start(): void {
  const store = createSettingsStore(app.getPath('userData'))
  let settings = store.get()
  const native = createNative()
  let dj: ReturnType<typeof createDj> | undefined
  const actions = createActions({ native, openTarget, launchApp, turnDj: dir => dj?.turn(dir), keyDown: native.keyDown, keyUp: native.keyUp })
  const dial = createDialController(settings, now())

  let hookState: AppStatus['hook'] = 'starting'
  let availability: Record<string, boolean> = {}
  let macroRunning: string | null = null
  let testMode = false
  let lastView: DialView = dial.view()
  let lastStatus = ''

  const status = (): AppStatus => {
    const a = dial.active()
    const system = a.kind === 'system' ? settings.mainDial.slots[a.slot] : undefined
    const fn = a.kind === 'system'
      ? SYSTEM_META[system?.type === 'system' ? system.control : 'volume']
      : settings.apps.find((x) => x.id === a.appId)?.slots[a.slot] ?? { name: '—', icon: 'empty-slot' }
    return {
      enabled: settings.enabled,
      hook: hookState,
      hookKind: hookState === 'ok' ? 'native' : 'none',
      active: { label: fn.name, icon: fn.icon },
      appAvailability: availability,
      macroRunning
    }
  }
  const pushStatus = (): void => {
    const a = dial.active()
    const slot = a.kind === 'system' ? settings.mainDial.slots[a.slot] : undefined
    dj?.setActive(settings.enabled && !testMode && hookState === 'ok' && slot?.type === 'system' && slot.control === 'dj')
    const s = status()
    const json = JSON.stringify(s)
    if (json !== lastStatus) { lastStatus = json; push(IPC.pushStatus, s) }
  }

  const showReadout = (r: Readout): void => {
    if (r.kind === 'value' && !settings.general.showReadout) return
    // Volume / brightness show as a big level dial in the middle of the screen the mouse is on.
    if (!lastView.open) placeOverlay(settings.general.opensOn)
    push(IPC.pushReadout, r)
  }

  // Actions and readouts run in order (a fallback message must not be covered by the value
  // readout of the step before it). Views are pushed at once so the dial never lags the knob.
  let queue: Promise<unknown> = Promise.resolve()
  const handle = (effects: DialEffect[]): void => {
    for (const e of effects) {
      if (e.type === 'view') {
        if (e.view.open && !lastView.open) placeOverlay(settings.general.opensOn)
        lastView = e.view
        push(IPC.pushDialView, e.view)
      } else if (e.type === 'readout') {
        const r = e.readout
        queue = queue.then(() => showReadout(r))
      } else if (e.type === 'system' && e.control === 'dj') {
        // Audio detents cannot wait behind slower system actions.
        void actions.run(e, settings).then((r) => { if (r) showReadout(r) })
      } else {
        queue = queue.then(() => actions.run(e, settings)).then((r) => { if (r) showReadout(r) })
      }
    }
    schedule()
    pushStatus()
  }

  // One timer for everything time-based (double-click wait, long press, dial auto-close).
  let timer: NodeJS.Timeout | undefined
  const engine = new GestureEngine(timing(settings), (g) => {
    push(IPC.pushGesture, g)
    if (!testMode) handle(dial.gesture(g, now()))
  })
  function schedule(): void {
    clearTimeout(timer)
    const due = [engine.nextDeadline(), dial.nextDeadline()].filter((d): d is number => d !== null)
    if (!due.length) return
    timer = setTimeout(() => {
      const t = now()
      engine.tick(t)
      handle(dial.tick(t))
    }, Math.max(0, Math.min(...due) - now()))
  }

  const hook = native.startKnobHook(
    (e) => { engine.raw(e.kind, now()); schedule() },
    () => { hookState = 'failed'; pushStatus() }
  )
  hookState = 'ok'

  let locating = false
  const refreshApps = (): void => {
    if (!locating && settings.apps.some(a => !a.exePath || !existsSync(a.exePath))) {
      const installed = listInstalledApps()
      let changed = false
      const apps = settings.apps.map(a => {
        if (a.exePath && existsSync(a.exePath)) return a
        const exePath = matchInstalled(a.processName, installed, existsSync)
        if (!exePath || exePath === a.exePath) return a
        changed = true
        return { ...a, exePath }
      })
      if (changed) {
        locating = true
        try { const next = validate({ ...settings, apps }).settings; apply(next); save(next) } finally { locating = false }
      }
    }
    availability = actions.checkApps(settings)
    handle(dial.setAppAvailability(availability))
  }

  const setTestMode = (active: boolean): void => {
    const next = Boolean(active)
    if (testMode === next) return
    testMode = next
    hook.setPassthrough(!settings.enabled && !testMode)
    if (testMode) {
      handle(dial.setSettings({ ...settings, enabled: false }, now()))
      push(IPC.pushReadout, null)
    } else {
      handle(dial.setSettings(settings, now()))
    }
  }

  /** Make `s` live everywhere. Saving to disk is separate (see save). */
  const apply = (s: Settings): void => {
    settings = s
    engine.setTiming(timing(s))
    hook.setPassthrough(!s.enabled && !testMode)
    if (app.isPackaged && s.general.startWithWindows !== getStartWithWindows()) setStartWithWindows(s.general.startWithWindows)
    handle(dial.setSettings(testMode ? { ...s, enabled: false } : s, now()))
    refreshApps()
    push(IPC.pushSettings, s)
    updateTray()
  }
  // Sliders send a new settings object on every drag step: apply at once, write to disk once they stop.
  let saveTimer: NodeJS.Timeout | undefined
  const write = (s: Settings): void => {
    try { store.set(s) } catch (err) {
      console.error('Saving settings failed', err)
      showReadout({ kind: 'warning', icon: 'warning', label: 'Settings could not be saved', value: null, percent: null })
    }
  }
  const save = (s: Settings): void => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saveTimer = undefined; write(s) }, 300)
  }
  const flush = (): void => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; write(settings) } }
  const replace = (s: Settings): void => { flush(); store.set(s); apply(store.get()) }

  native.watchForeground((fg) => handle(dial.setForeground(fg?.processName ?? null, now())))
  actions.onMacroState((id) => { macroRunning = id; dial.setMacroRunning(id); pushStatus() })
  setInterval(refreshApps, 10_000)

  registerIpc({
    listInstalledApps,
    getAppIcon,
    getSettings: () => settings,
    setSettings: (next) => { const s = validate(next).settings; apply(s); save(settings) },
    resetSettings: () => { replace(defaultSettings()); return settings },
    exportSettings: (path) => { flush(); exportSettings(store, path); return true },
    importSettings: (path) => {
      flush()
      const r = importSettings(store, path)
      if (r.ok) apply(store.get())
      return r.ok
    },
    getStatus: status,
    getDialView: () => dial.view(),
    runMacro: async (id) => { const r = await actions.run({ type: 'run-macro', macroId: id }, settings); if (r) showReadout(r) },
    stopMacro: () => actions.stopMacro(),
    setTestMode,
    minimizeWindow: (win) => win.minimize(),
    closeWindow: (win) => win.close()
  })

  dj = createDj(createOverlayWindow().webContents, native)
  createTray({
    onOpen: showDashboard,
    onTogglePause: () => replace({ ...settings, enabled: !settings.enabled }),
    onQuit: () => app.quit(),
    isPaused: () => !settings.enabled
  })
  apply(settings)
  const dashboardWin = createDashboardWindow()
  dashboardWin.on('hide', () => setTestMode(false))
  dashboardWin.on('closed', () => setTestMode(false))
  if (!process.argv.includes('--hidden')) showDashboard()

  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting) return
    const handoff = dj?.stop()
    if (handoff) {
      event.preventDefault()
      void handoff.then(() => app.quit())
      return
    }
    quitting = true
    flush(); actions.dispose(); native.dispose()
  })
}

function timing(s: Settings): ConstructorParameters<typeof GestureEngine>[0] {
  return { doubleMs: s.gestures.doubleClickMs, longMs: s.gestures.longPressMs, chainMs: s.gestures.holdChainMs }
}

if (ensureSingleInstance(showDashboard)) {
  app.whenReady().then(start)
  // The app lives in the tray; closing the dashboard only hides it.
  app.on('window-all-closed', () => {})
}
