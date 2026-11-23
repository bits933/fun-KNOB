import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type KreoApi } from '../shared/api'
function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
const api: KreoApi = {
  windowKind: process.argv.includes('--kreo-window=overlay') ? 'overlay' : 'dashboard',
  getSettings: () => ipcRenderer.invoke(IPC.getSettings), setSettings: next => ipcRenderer.invoke(IPC.setSettings, next),
  resetSettings: () => ipcRenderer.invoke(IPC.resetSettings), exportSettings: () => ipcRenderer.invoke(IPC.exportSettings), importSettings: () => ipcRenderer.invoke(IPC.importSettings),
  onSettings: cb => subscribe(IPC.pushSettings, cb), getStatus: () => ipcRenderer.invoke(IPC.getStatus), onStatus: cb => subscribe(IPC.pushStatus, cb),
  getDialView: () => ipcRenderer.invoke(IPC.getDialView), onDialView: cb => subscribe(IPC.pushDialView, cb), onReadout: cb => subscribe(IPC.pushReadout, cb), onGesture: cb => subscribe(IPC.pushGesture, cb),
  setTestMode: active => ipcRenderer.send(IPC.setTestMode, Boolean(active)),
  onDj: cb => subscribe(IPC.pushDj, cb),
  touchDj: () => ipcRenderer.send(IPC.touchDj),
  releaseDj: offsetMs => ipcRenderer.invoke(IPC.releaseDj, offsetMs),
  pickApp: () => ipcRenderer.invoke(IPC.pickApp), listInstalledApps: () => ipcRenderer.invoke(IPC.listInstalledApps), getAppIcon: exe => ipcRenderer.invoke(IPC.getAppIcon, exe), runMacro: id => ipcRenderer.invoke(IPC.runMacro, id), stopMacro: () => ipcRenderer.invoke(IPC.stopMacro),
  minimizeWindow: () => ipcRenderer.send(IPC.minimizeWindow), closeWindow: () => ipcRenderer.send(IPC.closeWindow)
}
contextBridge.exposeInMainWorld('kreo', api)
