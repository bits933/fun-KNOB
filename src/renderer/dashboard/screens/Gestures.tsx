import { defaultSettings } from '@shared/defaults'
import type { GestureSettings } from '@shared/types'
import { useSettings } from '../data'
import {
  Button,
  Card,
  Dropdown,
  PageHeader,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui'
import type { Option } from '../ui'
import type { ScreenProps } from './types'

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)} s`

const CLOSED_DOUBLE: Option<GestureSettings['closedDouble']>[] = [
  { value: 'play-pause', label: 'Play / pause' },
  { value: 'next-track', label: 'Next track' },
  { value: 'none', label: 'Do nothing' }
]
const CLOSED_LONG: Option<GestureSettings['closedLong']>[] = [
  { value: 'mute', label: 'Mute' },
  { value: 'none', label: 'Do nothing' }
]
const HOLD_ROTATE: Option<GestureSettings['holdRotate']>[] = [
  { value: 'cycle', label: 'Previous / next function' },
  { value: 'none', label: 'Do nothing' }
]

const Fixed = ({ children }: { children: string }): React.JSX.Element => (
  <span className={children === '—' ? 'text-[14px] text-subtle-foreground/60' : 'text-[14px] text-muted-foreground'}>{children}</span>
)
const HEAD = 'h-9 text-[12px] font-medium uppercase tracking-[0.06em] text-subtle-foreground'
const NAME = 'pl-0 py-3.5 text-[14.5px] font-medium text-foreground'
const ROW = 'hover:bg-transparent'

/** Gestures: the PRD §6 table (changeable actions are dropdowns) and the three timing sliders. */
export function Gestures({ toast }: ScreenProps): React.JSX.Element {
  const { settings, update } = useSettings()
  const g = settings?.gestures
  const set = (patch: Partial<GestureSettings>): void => void update((s) => { Object.assign(s.gestures, patch) })

  return (
    <>
      <PageHeader title="Gestures" description="What the knob does, and how fast." />
      <Card title="Actions">
        <Table aria-label="Gesture actions">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-[164px] pl-0 ${HEAD}`}>Gesture</TableHead>
              <TableHead className={`w-[272px] ${HEAD}`}>Dial closed</TableHead>
              <TableHead className={HEAD}>Dial open</TableHead>
              <TableHead className={`pr-0 ${HEAD}`}>On an app</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className={ROW}>
              <TableCell className={NAME}>Rotate</TableCell>
              <TableCell><Fixed>Active function</Fixed></TableCell>
              <TableCell><Fixed>Move highlight</Fixed></TableCell>
              <TableCell className="pr-0"><Fixed>Move highlight</Fixed></TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell className={NAME}>Click</TableCell>
              <TableCell><Fixed>Open main dial</Fixed></TableCell>
              <TableCell><Fixed>Choose</Fixed></TableCell>
              <TableCell className="pr-0"><Fixed>Open the app</Fixed></TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell className={NAME}>Double click</TableCell>
              <TableCell className="py-2.5">
                {g && (
                  <Dropdown
                    className="w-[244px]"
                    aria-label="Double click, dial closed"
                    value={g.closedDouble}
                    options={CLOSED_DOUBLE}
                    onChange={(v) => set({ closedDouble: v })}
                  />
                )}
              </TableCell>
              <TableCell><Fixed>Back</Fixed></TableCell>
              <TableCell className="pr-0"><Fixed>Open app&apos;s controls</Fixed></TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell className={NAME}>Long press</TableCell>
              <TableCell className="py-2.5">
                {g && (
                  <Dropdown
                    className="w-[244px]"
                    aria-label="Long press, dial closed"
                    value={g.closedLong}
                    options={CLOSED_LONG}
                    onChange={(v) => set({ closedLong: v })}
                  />
                )}
              </TableCell>
              <TableCell><Fixed>Back</Fixed></TableCell>
              <TableCell className="pr-0"><Fixed>Back</Fixed></TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell className={NAME}>Hold + rotate</TableCell>
              <TableCell className="py-2.5">
                {g && (
                  <Dropdown
                    className="w-[244px]"
                    aria-label="Hold and rotate, dial closed"
                    value={g.holdRotate}
                    options={HOLD_ROTATE}
                    onChange={(v) => set({ holdRotate: v })}
                  />
                )}
              </TableCell>
              <TableCell><Fixed>—</Fixed></TableCell>
              <TableCell className="pr-0"><Fixed>—</Fixed></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
      <Card
        title="Timing"
        headerRight={
          <Button
            variant="ghost"
            size="sm"
            icon="reset"
            onClick={() => {
              const d = defaultSettings().gestures
              set(d)
              toast('Gestures reset')
            }}
          >
            Reset to defaults
          </Button>
        }
      >
        {g && (
          <div className="grid grid-cols-3 gap-8">
            <Slider
              label="Double-click speed"
              min={150}
              max={600}
              step={10}
              value={g.doubleClickMs}
              format={seconds}
              onChange={(v) => set({ doubleClickMs: v })}
            />
            <Slider
              label="Long-press time"
              min={300}
              max={1000}
              step={10}
              value={g.longPressMs}
              format={seconds}
              onChange={(v) => set({ longPressMs: v })}
            />
            <Slider
              label="Hold-and-turn gap"
              min={300}
              max={1200}
              step={10}
              value={g.holdChainMs}
              format={seconds}
              onChange={(v) => set({ holdChainMs: v })}
            />
          </div>
        )}
      </Card>
    </>
  )
}
