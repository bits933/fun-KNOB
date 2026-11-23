import { useState } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { SYSTEM_META } from '@shared/defaults'
import type { GeneralSettings, LevelPosition, SystemControl } from '@shared/types'
import { api, useSettings } from '../data'
import { Button, Card, ConfirmDialog, Dropdown, ListRow, PageHeader, PositionGrid, Separator, Slider, Switch } from '../ui'
import type { Option } from '../ui'
import type { ScreenProps } from './types'

const OPENS_ON: Option<GeneralSettings['opensOn']>[] = [
  { value: 'cursor-screen', label: 'Screen with the mouse' },
  { value: 'primary-screen', label: 'Main screen' }
]
const secs = (ms: number): string => `${Number((ms / 1000).toFixed(1))} s`
const formatPosition = (p: LevelPosition): string => p.replace('-', ' ').replace(/^./, (c) => c.toUpperCase())

/** Settings: start-up switches, dial size / auto-close / screen, export, import and reset (with confirm). */
export function Settings({ toast }: ScreenProps): React.JSX.Element {
  const { settings, update } = useSettings()
  const [confirming, setConfirming] = useState(false)
  const gen = settings?.general
  const set = (patch: Partial<GeneralSettings>): void => void update((s) => { Object.assign(s.general, patch) })
  const controls = [...new Set([
    ...(settings?.mainDial.slots.flatMap((s) => (s.type === 'system' ? [s.control] : [])) ?? []),
    ...(gen?.defaultControl ? [gen.defaultControl] : [])
  ])]
  const defaultOptions: Option<string>[] = [
    ...controls.map((c) => ({ value: c, label: SYSTEM_META[c].name, lead: <Icon name={SYSTEM_META[c].icon} size={17} /> })),
    { value: 'none', label: 'None (stay on last)' }
  ]

  const run = async (job: () => Promise<boolean>, ok: string): Promise<void> => {
    try {
      if (await job()) toast(ok)
    } catch {
      toast('Something went wrong', 'warning')
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Start-up, the dial, and your backup." />
      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <Card title="General">
            {gen && (
              <div className="flex flex-col">
                <ListRow
                  flush
                  icon="power"
                  title="Start with Windows"
                  subtitle="Launch fun KNOB when you sign in"
                  trailing={<Switch label="Start with Windows" checked={gen.startWithWindows} onChange={(v) => set({ startWithWindows: v })} />}
                />
                <Separator className="my-1.5" />
                <ListRow
                  flush
                  icon="settings"
                  title="Run as administrator"
                  subtitle="Needed to control apps that run as admin"
                  trailing={<Switch label="Run as administrator" checked={gen.runAsAdmin} onChange={(v) => set({ runAsAdmin: v })} />}
                />
                <Separator className="my-1.5" />
                <ListRow
                  flush
                  icon="dial"
                  title="Show readout when turning"
                  subtitle="A small pill shows the value for 1 s"
                  trailing={<Switch label="Show readout when turning" checked={gen.showReadout} onChange={(v) => set({ showReadout: v })} />}
                />
              </div>
            )}
          </Card>
          <Card title="Backup">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" icon="download" className="w-full justify-center" onClick={() => void run(() => api.exportSettings(), 'Setup exported')}>
                  Export setup
                </Button>
                <Button variant="secondary" icon="upload" className="w-full justify-center" onClick={() => void run(() => api.importSettings(), 'Setup imported')}>
                  Import setup
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13.5px] text-muted-foreground">Restore factory defaults</span>
                <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Reset everything</Button>
              </div>
            </div>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Reset everything?"
              description="Reset every setting, app and macro to factory defaults?"
              confirmLabel="Yes, reset"
              destructive
              onConfirm={() => {
                setConfirming(false)
                void run(async () => { await api.resetSettings(); return true }, 'Everything was reset')
              }}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Dial">
            {gen && (
              <div className="flex flex-col gap-5">
                <Slider
                  label="Dial size"
                  min={60}
                  max={140}
                  step={5}
                  value={gen.dialSizePercent}
                  format={(v) => `${v}%`}
                  onChange={(v) => set({ dialSizePercent: v })}
                />
                <Slider
                  label="Level ring size"
                  min={40}
                  max={140}
                  step={5}
                  value={gen.levelSizePercent}
                  format={(v) => `${v}%`}
                  onChange={(v) => set({ levelSizePercent: v })}
                />
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[14.5px] font-medium text-foreground">Dial position</span>
                    <span className="text-[13px] text-muted-foreground">{formatPosition(gen.levelPosition)}</span>
                  </div>
                  <PositionGrid aria-label="Dial position" value={gen.levelPosition} onChange={(v) => set({ levelPosition: v })} />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[14.5px] font-medium text-foreground">Default option</span>
                  <Dropdown
                    className="w-[232px] shrink-0"
                    aria-label="Default option"
                    value={gen.defaultControl ?? 'none'}
                    options={defaultOptions}
                    onChange={(v) => set({ defaultControl: v === 'none' ? null : (v as SystemControl) })}
                  />
                </div>
                {gen.defaultControl !== null && (
                  <Slider
                    label="Return to default after"
                    min={5000}
                    max={60000}
                    step={5000}
                    value={gen.defaultReturnMs}
                    format={(ms) => `${Math.round(ms / 1000)} s`}
                    onChange={(v) => set({ defaultReturnMs: v })}
                  />
                )}
                <Separator />
                <Slider
                  label="Auto-close after"
                  min={1000}
                  max={10000}
                  step={500}
                  value={gen.autoCloseMs}
                  format={secs}
                  onChange={(v) => set({ autoCloseMs: v })}
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[14.5px] font-medium text-foreground">Opens on</span>
                  <Dropdown
                    className="w-[232px] shrink-0"
                    aria-label="Opens on"
                    value={gen.opensOn}
                    options={OPENS_ON}
                    onChange={(v) => set({ opensOn: v })}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
