import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
let dashboard: BrowserWindow | undefined
let overlay: BrowserWindow | undefined
let quitting = false
app.on('before-quit', () => { quitting = true })
function load(win: BrowserWindow, kind: 'dashboard' | 'overlay'): void {
  const url = process.env.ELECTRON_RENDERER_URL
  if (url) void win.loadURL(`${url}/${kind}/index.html`)
  else void win.loadFile(join(__dirname, `../renderer/${kind}/index.html`))
}
function preferences(kind: string): Electron.WebPreferences {
  return { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true, additionalArguments: [`--kreo-window=${kind}`] }
}
export function createDashboardWindow(): BrowserWindow {
  if (dashboard && !dashboard.isDestroyed()) return dashboard
  const win = new BrowserWindow({ width: 1280, height: 800, minWidth: 1100, minHeight: 680, frame: false, resizable: true, backgroundColor: '#000000', webPreferences: preferences('dashboard') })
  dashboard = win
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide() } })
  win.on('closed', () => { dashboard = undefined })
  load(win, 'dashboard')
  return win
}
export function showDashboard(): void { const win = createDashboardWindow(); if (win.isMinimized()) win.restore(); win.show(); win.focus() }
export function createOverlayWindow(): BrowserWindow {
  if (overlay && !overlay.isDestroyed()) return overlay
  const win = new BrowserWindow({ width: 560, height: 640, show: false, transparent: true, frame: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, resizable: false, webPreferences: { ...preferences('overlay'), autoplayPolicy: 'no-user-gesture-required' } })
  overlay = win
  const reassert = (): void => { if (!win.isDestroyed()) win.setAlwaysOnTop(true, 'screen-saver') }
  screen.on('display-added', reassert)
  screen.on('display-removed', reassert)
  screen.on('display-metrics-changed', reassert)
  win.once('closed', () => { screen.removeListener('display-added', reassert); screen.removeListener('display-removed', reassert); screen.removeListener('display-metrics-changed', reassert) })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  win.on('closed', () => { overlay = undefined })
  load(win, 'overlay')
  win.showInactive()
  return win
}
export function placeOverlay(opensOn: 'cursor-screen' | 'primary-screen'): void {
  const win = createOverlayWindow()
  const display = opensOn === 'primary-screen' ? screen.getPrimaryDisplay() : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width: w, height: h } = display.workArea
  // The window covers the whole work area (click-through); the renderer centres the dial and places the level ring.
  win.setBounds({ x, y, width: w, height: h })
  win.setAlwaysOnTop(true, 'screen-saver')
}


