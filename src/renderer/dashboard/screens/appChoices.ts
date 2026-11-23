import type { PickedApp } from '@shared/api'
import type { AppDef, CustomSlot, Settings } from '@shared/types'
import { newId } from './helpers'

export type AppChoice = PickedApp & { id?: string; icon?: string }

export const sameApp = (a: PickedApp, b: PickedApp): boolean =>
  (!!a.processName && a.processName.toLowerCase() === b.processName.toLowerCase()) ||
  (!!a.exePath && a.exePath.toLowerCase() === b.exePath.toLowerCase())

export function mergeAppChoices(saved: AppChoice[], installed: PickedApp[]): AppChoice[] {
  const choices = [...saved]
  for (const app of installed) if (!choices.some(a => sameApp(a, app))) choices.push(app)
  return choices.sort((a, b) => a.name.localeCompare(b.name))
}

/** Resolve only referenced draft apps, in the same settings transaction as the slot. */
export function saveSlotApps(settings: Settings, slot: CustomSlot, pending: AppDef[]): CustomSlot {
  const resolve = (id: string): string => {
    const draft = pending.find(a => a.id === id)
    if (!draft) return id
    const existing = settings.apps.find(a => sameApp(a, draft))
    if (existing) return existing.id
    const app = { ...draft, id: newId('app') }
    settings.apps.push(app)
    return app.id
  }
  if (slot.type === 'app') return { ...slot, appId: resolve(slot.appId) }
  if (slot.type === 'folder') return { ...slot, items: slot.items.map(it => it?.type === 'app' ? { ...it, appId: resolve(it.appId) } : it) }
  return slot
}
