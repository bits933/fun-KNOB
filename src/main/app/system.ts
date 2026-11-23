import { app } from 'electron'
// The portable build runs from a temp folder; the login item must point at the real .exe.
const exe = (): string => process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath
export function setStartWithWindows(on: boolean): void { app.setLoginItemSettings({ openAtLogin: on, path: exe(), args: ['--hidden'] }) }
export function getStartWithWindows(): boolean { return app.getLoginItemSettings({ path: exe(), args: ['--hidden'] }).openAtLogin }
export function ensureSingleInstance(onSecondInstance: () => void): boolean {
  if (!app.requestSingleInstanceLock()) { app.quit(); return false }
  app.on('second-instance', onSecondInstance)
  return true
}
