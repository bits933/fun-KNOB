import { app, Menu, Tray } from 'electron'
import { join } from 'node:path'
type Options = { onOpen: () => void; onTogglePause: () => void; onQuit: () => void; isPaused: () => boolean }
let tray: Tray | undefined
let options: Options
export function createTray(opts: Options): Tray {
  options = opts
  tray = new Tray(app.isPackaged ? join(process.resourcesPath, 'tray.png') : join(app.getAppPath(), 'resources/tray.png'))
  tray.on('double-click', opts.onOpen)
  updateTray()
  return tray
}
export function updateTray(): void {
  if (!tray) return
  const paused = options.isPaused()
  tray.setToolTip(paused ? 'Kreo Dial (paused)' : 'Kreo Dial')
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open dashboard', click: options.onOpen }, { label: paused ? 'Resume' : 'Pause', click: options.onTogglePause }, { label: 'Quit', click: options.onQuit }]))
}
