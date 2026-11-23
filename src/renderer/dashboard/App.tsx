import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useSettings } from './data'
import { SCREENS, SCREEN_IDS } from './screens'
import type { ScreenId } from './screens'
import { NavRail, TitleBar, TooltipProvider, useToast } from './ui'

const LEAVE_MS = 140
const NAV_STORAGE_KEY = 'kreo.navCollapsed'

const searchParams = new URLSearchParams(window.location.search)
const queryScreen = searchParams.get('screen')
const queryNav = searchParams.get('nav')

function initialScreen(): ScreenId {
  return SCREEN_IDS.find((s) => s === queryScreen) ?? 'main-dial'
}

function initialCollapsed(): boolean {
  if (queryNav === 'collapsed') return true
  if (queryNav === 'expanded') return false
  try {
    return window.localStorage.getItem(NAV_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Window frame: title bar, collapsible nav rail, and the current screen with a short cross-fade.
 * `?screen=<id>` picks the first screen (for screenshots); `?nav=collapsed` sets initial sidebar state.
 */
export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>(initialScreen)
  const [leaving, setLeaving] = useState<ScreenId | null>(null)
  const [animate, setAnimate] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed)
  const current = useRef(screen)
  const timer = useRef<number | undefined>(undefined)
  const { settings, update } = useSettings()
  const { toast, show } = useToast()

  const navigate = useCallback((id: ScreenId) => {
    if (id === current.current) return
    setLeaving(current.current)
    current.current = id
    setScreen(id)
    setAnimate(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLeaving(null), LEAVE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(NAV_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Ignore storage errors in restricted contexts
      }
      return next
    })
  }, [])

  // Ctrl+B / Cmd+B toggles sidebar collapse when not typing or recording a shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null
        if (target?.closest('input, textarea, [contenteditable="true"], .k-rec')) return
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCollapsed])

  // First launch (no ?screen= given): show the welcome steps once the settings have loaded.
  const firstRunChecked = useRef(false)
  const needsFirstRun = settings ? !settings.general.firstRunDone : null
  useEffect(() => {
    if (needsFirstRun === null || firstRunChecked.current) return
    firstRunChecked.current = true
    if (needsFirstRun && !queryScreen) navigate('first-run')
  }, [needsFirstRun, navigate])

  const Current = SCREENS[screen]
  const Leaving = leaving ? SCREENS[leaving] : null
  const props = { navigate, toast: show }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="app">
        <TitleBar onMinimize={() => api.minimizeWindow()} onClose={() => api.closeWindow()} />
        <div className="app__body">
          {screen !== 'first-run' && (
            <NavRail
              selected={screen}
              onSelect={(id) => navigate(id as ScreenId)}
              running={settings?.enabled ?? true}
              onToggleRunning={(v) => void update((s) => { s.enabled = v })}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapsed}
            />
          )}
          <main className="app__screens relative flex-1 min-w-0">
            {Leaving && (
              <div key={`out-${leaving}`} className="screen screen--leaving" aria-hidden="true" inert>
                <Leaving {...props} />
              </div>
            )}
            <div key={screen} className={animate ? 'screen screen--in' : 'screen'}>
              <Current {...props} />
            </div>
            {toast}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
