import { useState } from 'react'
import { DEFAULT_APPS } from '@shared/defaults'
import type { AppDef } from '@shared/types'
import { MAX_SLOTS } from '@shared/types'
import { api, useSettings, useStatus } from '../data'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, ListGroup, ListRow, PageHeader, Separator, Tooltip, TooltipContent, TooltipTrigger, useFadeRemove } from '../ui'
import { cn } from '../lib/utils'
import { DialWheel, moveItem } from './DialWheel'
import { SlotIcon } from '@renderer/icons/SlotIcon'
import { appDialView, appSlot, newId, removeRefs, shortcutCount, usages } from './helpers'
import { AppSlotPanel, queryParam } from './parts'
import type { ScreenProps } from './types'

const isDefault = (id: string): boolean => DEFAULT_APPS.some((a) => a.id === id)

/** Apps: list of apps with their dials. Pick an app, then a slot, to edit its shortcuts in the side panel. */
export function Apps({ toast }: ScreenProps): React.JSX.Element | null {
  const { settings, update } = useSettings()
  const status = useStatus()
  const [appId, setAppId] = useState<string | null>(() => queryParam('app'))
  const [slot, setSlot] = useState<number | null>(() => {
    const n = Number(queryParam('slot'))
    return n >= 1 && n <= MAX_SLOTS ? n - 1 : null
  })
  const [confirm, setConfirm] = useState<'remove' | null>(null)
  const { leaving, remove } = useFadeRemove<string>()
  if (!settings) return null

  const app = settings.apps.find((a) => a.id === appId) ?? settings.apps[0] ?? null
  const missing = !!app && status?.appAvailability[app.id] === false
  const panelOpen = slot !== null && !!app && !missing
  const choose = (id: string): void => {
    setAppId(id)
    setSlot(null)
    setConfirm(null)
  }

  const addApp = async (): Promise<void> => {
    const p = await api.pickApp()
    if (!p) return
    const dup = settings.apps.find((a) => a.processName.toLowerCase() === p.processName.toLowerCase())
    if (dup) {
      choose(dup.id)
      toast('That app is already in the list', 'info')
      return
    }
    const id = newId('app')
    await update((s) => {
      s.apps.push({ id, name: p.name, icon: 'apps-folder', exePath: p.exePath, processName: p.processName, slots: Array<null>(MAX_SLOTS).fill(null) })
    })
    choose(id)
  }

  const locate = async (): Promise<void> => {
    if (!app) return
    const p = await api.pickApp()
    if (!p) return
    await update((s) => {
      const a = s.apps.find((x) => x.id === app.id)
      if (a) {
        a.exePath = p.exePath
        a.processName = p.processName
      }
    })
    toast('Location saved')
  }

  const removeApp = (a: AppDef): void => {
    setConfirm(null)
    remove(a.id, () => {
      void update((s) => {
        s.apps = s.apps.filter((x) => x.id !== a.id)
        removeRefs(s, { appId: a.id })
      })
      setSlot(null)
      setAppId(null)
      toast(`${a.name} removed`)
    })
  }

  const resetApp = (a: AppDef): void => {
    void update((s) => {
      const t = s.apps.find((x) => x.id === a.id)
      if (t) t.slots = structuredClone(DEFAULT_APPS.find((d) => d.id === a.id)?.slots ?? Array<null>(MAX_SLOTS).fill(null))
    })
    setSlot(null)
    toast(isDefault(a.id) ? `${a.name} reset to defaults` : 'All slots cleared')
  }

  const where = app ? usages(settings, { appId: app.id }) : []

  return (
    <div className={panelOpen ? 'split apps apps--panel' : 'split apps'}>
      <div className="split__pane"><div className="split__main">
        <PageHeader title="Apps" description="Double click an app on the dial to use these controls." />
        <div className="flex gap-6 flex-1 min-h-0">
          {panelOpen ? (
            <aside
              aria-label="Apps"
              className="dc-glass k-side-theme !bg-[#111111] !border-[#1f1f1f] w-[68px] shrink-0 flex flex-col items-center rounded-[20px] py-2.5 px-2 gap-1.5 min-h-0 max-h-full"
            >
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1.5 w-full">
                {settings.apps.map((a) => {
                  const gone = status?.appAvailability[a.id] === false
                  const selected = a.id === app?.id
                  return (
                    <Tooltip key={a.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={a.name}
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => choose(a.id)}
                          className={cn(
                            'relative flex items-center justify-center shrink-0 w-12 h-12 rounded-xl border transition-[background-color,border-color,color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:border-active-border',
                            selected
                              ? 'border-transparent bg-white/[0.08] text-foreground'
                              : 'border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
                            gone && 'ring-1 ring-warning/65',
                            leaving === a.id && 'k-row-leave'
                          )}
                        >
                          <SlotIcon slot={appSlot(a)} size={23} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{a.name}</span>
                          <span className="text-[12px] text-muted-foreground">{gone ? 'Not found' : shortcutCount(a)}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
              <Separator className="my-1 w-7" />
              <IconButton icon="plus" label="Add app" className="text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" onClick={() => void addApp()} />
            </aside>
          ) : (
            <aside
              aria-label="Apps"
              className="dc-glass k-side-theme !bg-[#111111] !border-[#1f1f1f] w-[288px] shrink-0 flex flex-col rounded-[20px] p-3 min-h-0 max-h-full"
            >
              <ListGroup className="flex-1 min-h-0 overflow-y-auto gap-1.5">
                {settings.apps.map((a) => {
                  const gone = status?.appAvailability[a.id] === false
                  return (
                    <ListRow
                      key={a.id}
                      className={leaving === a.id ? 'k-row-leave' : undefined}
                      leading={<span className="k-row__lead flex items-center justify-center shrink-0 w-9 h-9 bg-transparent border-0"><SlotIcon slot={appSlot(a)} size={24} /></span>}
                      title={a.name}
                      subtitle={shortcutCount(a)}
                      trailing={gone ? <Badge type="not-found" /> : 'chevron'}
                      error={gone}
                      selected={a.id === app?.id}
                      onClick={() => choose(a.id)}
                    />
                  )
                })}
              </ListGroup>
              <Separator className="my-2.5" />
              <Button variant="ghost" size="sm" icon="plus" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-primary/14" onClick={() => void addApp()}>Add app</Button>
            </aside>
          )}

          {app && missing ? (
            <EmptyState card tone="warning" icon="warning" title={`${app.name} was not found`} description="It may have been moved or uninstalled.">
              <Button variant="primary" onClick={() => void locate()}>Locate app</Button>
              <Button onClick={() => setConfirm('remove')}>Remove</Button>
            </EmptyState>
          ) : app ? (
            <div className="apps__stage dial-drop-zone relative flex-1 min-w-0 flex flex-col items-center justify-center gap-3 -mb-8 pb-8 overflow-hidden">
              <DialWheel key={app.id} view={appDialView(app, 0)} selected={slot} onSelect={setSlot} onOpen={() => {}} pathKey={app.id} backward={false}
                kinds={app.slots.map(s => s ? 'Shortcut' : 'Empty')}
                onMove={(from, to) => { void update(s => { const a = s.apps.find(a => a.id === app.id); if (a) a.slots = moveItem(a.slots, from, to) }); setSlot(i => i === null ? null : moveItem([...app.slots.keys()], from, to).indexOf(i)) }}
                onRemove={i => { if (app.slots.length <= 4) return; void update(s => { s.apps.find(a => a.id === app.id)?.slots.splice(i, 1) }); setSlot(null) }}
                onAdd={() => { if (app.slots.length >= MAX_SLOTS) return; void update(s => { s.apps.find(a => a.id === app.id)?.slots.push(null) }); setSlot(null) }} />
              {slot === null && (
                <div className="flex items-center justify-between w-full pt-2">
                  <span className="text-[13.5px] text-subtle-foreground">Click a slot to edit its shortcuts.</span>
                  {!isDefault(app.id) && <Button variant="danger" size="sm" onClick={() => setConfirm('remove')}>Remove app</Button>}
                </div>
              )}
            </div>
          ) : (
            <EmptyState card icon="apps-folder" title="No apps yet" description="Add a program to give it a dial of shortcuts.">
              <Button variant="primary" icon="plus" onClick={() => void addApp()}>Add app</Button>
            </EmptyState>
          )}
        </div>
      </div></div>
      {panelOpen && app && slot !== null && (
        <AppSlotPanel
          key={`${app.id}:${slot}`}
          app={app}
          index={slot}
          onClose={() => setSlot(null)}
          onSave={(next) => {
            void update((s) => {
              const t = s.apps.find((x) => x.id === app.id)
              if (t) t.slots[slot] = next
            })
            toast('Saved')
            setSlot(null)
          }}
          onClear={() => {
            void update((s) => {
              const t = s.apps.find((x) => x.id === app.id)
              if (t) t.slots[slot] = null
            })
            toast('Slot cleared')
            setSlot(null)
          }}
          onReset={() => resetApp(app)}
        />
      )}
      {app && (
        <ConfirmDialog
          open={confirm === 'remove'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`Remove ${app.name}?`}
          description={`Remove ${app.name} and its dial?${where.length > 0 ? ` It is used in ${where.join(', ')}; those places will be emptied.` : ''}`}
          confirmLabel="Remove"
          onConfirm={() => removeApp(app)}
        />
      )}
    </div>
  )
}
