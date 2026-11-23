import { BrowserWindow, dialog, ipcMain } from 'electron'
import { basename, extname } from 'node:path'
import { IPC, type KreoApi } from '../../shared/api'
import type { Settings, AppStatus, DialView, Readout, Gesture } from '../../shared/types'
type Result<T> = T | Promise<T>
export interface IpcHandlers {
  listInstalledApps(): ReturnType<KreoApi['listInstalledApps']> | Awaited<ReturnType<KreoApi['listInstalledApps']>>
  getAppIcon(exePath: string): Result<string | null>
  getSettings(): Result<Settings>; setSettings(next: Settings): Result<void>; resetSettings(): Result<Settings>
  exportSettings(path: string): Result<boolean>; importSettings(path: string): Result<boolean>
  getStatus(): Result<AppStatus>; getDialView(): Result<DialView>; runMacro(id: string): Result<void>; stopMacro(): Result<void>
  setTestMode(active: boolean): void
  minimizeWindow(win: BrowserWindow): void; closeWindow(win: BrowserWindow): void
}
type PushPayloads = { [IPC.pushSettings]: Settings; [IPC.pushStatus]: AppStatus; [IPC.pushDialView]: DialView; [IPC.pushReadout]: Readout | null; [IPC.pushGesture]: Gesture }
export function pushTo<C extends keyof PushPayloads>(win: BrowserWindow, channel: C, payload: PushPayloads[C]): void { if (!win.isDestroyed()) win.webContents.send(channel, payload) }
export function push<C extends keyof PushPayloads>(channel: C, payload: PushPayloads[C]): void { BrowserWindow.getAllWindows().forEach(win => pushTo(win, channel, payload)) }
export function registerIpc(h: IpcHandlers): void {
  ipcMain.handle(IPC.listInstalledApps, () => h.listInstalledApps())
  ipcMain.handle(IPC.getAppIcon, (_, exePath: string) => h.getAppIcon(String(exePath ?? '')))
  ipcMain.handle(IPC.getSettings, () => h.getSettings()); ipcMain.handle(IPC.setSettings, (_, s: Settings) => h.setSettings(s)); ipcMain.handle(IPC.resetSettings, () => h.resetSettings())
  ipcMain.handle(IPC.getStatus, () => h.getStatus()); ipcMain.handle(IPC.getDialView, () => h.getDialView())
  ipcMain.handle(IPC.runMacro, (_, id: string) => h.runMacro(id)); ipcMain.handle(IPC.stopMacro, () => h.stopMacro())
  ipcMain.handle(IPC.pickApp, async (): ReturnType<KreoApi['pickApp']> => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Applications', extensions: ['exe'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const exePath = result.filePaths[0], processName = basename(exePath)
    return { exePath, processName, name: basename(exePath, extname(exePath)) }
  })
  ipcMain.handle(IPC.exportSettings, async () => { const r = await dialog.showSaveDialog({ defaultPath: 'kreo-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); return r.canceled || !r.filePath ? false : h.exportSettings(r.filePath) })
  ipcMain.handle(IPC.importSettings, async () => { const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }); return r.canceled || !r.filePaths[0] ? false : h.importSettings(r.filePaths[0]) })
  ipcMain.on(IPC.setTestMode, (_, active: boolean) => h.setTestMode(Boolean(active)))
  ipcMain.on(IPC.minimizeWindow, e => { const win = BrowserWindow.fromWebContents(e.sender); if (win) h.minimizeWindow(win) })
  ipcMain.on(IPC.closeWindow, e => { const win = BrowserWindow.fromWebContents(e.sender); if (win) h.closeWindow(win) })
}
