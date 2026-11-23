import { Icon } from '@renderer/icons/Icon'
import { useDialView, useReadout, useSettings, useStatus } from '../data'
import { Badge, Banner, Button, Card, cx, DialPreview, ListRow, PageHeader, Separator, Switch } from '../ui'
import type { ScreenProps } from './types'

/** Home: live main-dial glass preview, active function, quick actions, on/off + start-with-Windows. */
export function Home({ navigate }: ScreenProps): React.JSX.Element {
  const { settings, update } = useSettings()
  const status = useStatus()
  const view = useDialView()
  const readout = useReadout()
  const enabled = settings?.enabled ?? true

  return (
    <div className={enabled ? 'home' : 'home home--paused'}>
      <PageHeader title="Home" description="Your knob, at a glance." side={enabled && <Badge type="running" />} />
      {!enabled && (
        <Banner action={<Button variant="primary" size="sm" onClick={() => void update((s) => { s.enabled = true })}>Resume</Button>}>
          Kreo Dial is paused. The knob controls volume as normal.
        </Banner>
      )}
      {readout?.kind === 'warning' && (
        <Banner
          icon={readout.icon}
          action={readout.label.endsWith('not found') ? <Button size="sm" onClick={() => navigate('apps')}>Locate app</Button> : undefined}
        >
          <div className="home__warning truncate" title={readout.label}>{readout.label}</div>
        </Banner>
      )}
      <div className={cx('grid grid-cols-[minmax(0,1fr)_384px] gap-6 items-stretch transition-opacity duration-300', !enabled && 'opacity-45')}>
        <Card
          title="Main dial"
          headerRight={
            view ? (
              <span className="inline-flex items-center h-7 px-3 rounded-full bg-white/[0.045] border border-white/[0.07] text-[12.5px] font-medium text-muted-foreground tabular-nums">
                {view.slots.length} slots
              </span>
            ) : undefined
          }
          className="relative flex flex-col min-h-0 overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 54%, rgba(57, 105, 90, 0.08) 0%, transparent 58%)'
            }}
          />
          <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center -my-3">
            {view && <DialPreview view={view} size={460} />}
          </div>
        </Card>
        <div className="flex flex-col gap-5 h-full min-h-0">
          <Card title="Active function" className="k-side-theme !bg-[#111111] !border-[#1f1f1f]">
            <div className="home__active flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-primary/14 border-0 text-accent-foreground flex items-center justify-center shrink-0">
                <Icon name={status?.active.icon ?? 'volume'} size={24} />
              </span>
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <span className="text-[20px] font-semibold leading-tight tracking-[-0.015em] text-foreground truncate">{status?.active.label ?? 'Volume'}</span>
                <span className="text-[13.5px] text-muted-foreground truncate">
                  {enabled ? 'Turn the knob to adjust' : 'Paused — acting as standard volume knob'}
                </span>
              </div>
            </div>
          </Card>
          <Card title="Quick actions" className="k-side-theme !bg-[#111111] !border-[#1f1f1f]">
            <div className="flex flex-col gap-3">
              <Button variant="primary" icon="dial" className="w-full justify-center" onClick={() => navigate('main-dial')}>
                Open main dial setup
              </Button>
              <Button variant="secondary" icon="test" className="w-full justify-center" onClick={() => navigate('test')}>
                Test gestures
              </Button>
            </div>
          </Card>
          <Card title="Status" className="k-side-theme !bg-[#111111] !border-[#1f1f1f] flex-1">
            <div className="flex flex-col">
              <ListRow
                flush
                icon="power"
                title="Running"
                subtitle="The knob is controlling your PC"
                trailing={<Switch label="Running" checked={enabled} onChange={(v) => void update((s) => { s.enabled = v })} />}
              />
              <Separator className="my-1.5" />
              <ListRow
                flush
                icon="settings"
                title="Start with Windows"
                subtitle="Launch in the tray at sign-in"
                trailing={
                  <Switch
                    label="Start with Windows"
                    checked={settings?.general.startWithWindows ?? false}
                    onChange={(v) => void update((s) => { s.general.startWithWindows = v })}
                  />
                }
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
