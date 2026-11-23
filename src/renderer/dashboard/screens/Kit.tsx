import { useState } from 'react'
import type { KeyName } from '@shared/types'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  IconButton,
  KeyCombo,
  ListGroup,
  ListRow,
  MacroStepRow,
  PageHeader,
  ReadoutPill,
  SegmentedControl,
  ShortcutRecorder,
  SidePanel,
  Slider,
  Switch,
  TextInput,
  Toast,
  UiBadge
} from '../ui'
import type { ScreenProps } from './types'

const OPTIONS = [
  { value: 'volume', label: 'Volume' },
  { value: 'brightness', label: 'Brightness' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'zoom', label: 'Zoom' }
]
const KINDS = ['system', 'app', 'macro', 'folder'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))

/** Living style guide, reachable at `?screen=kit` (not in the nav). Every UI-kit component in its main states. */
export function Kit(_props: ScreenProps): React.JSX.Element {
  const [on, setOn] = useState(true)
  const [v, setV] = useState(30)
  const [stepsV, setStepsV] = useState(3)
  const [dd, setDd] = useState('volume')
  const [seg, setSeg] = useState('app')
  const [text, setText] = useState('Brush size')
  const [keys, setKeys] = useState<KeyName[] | null>(['Ctrl', 'Shift', '['])
  const [empty, setEmpty] = useState<KeyName[] | null>(null)
  const [sel, setSel] = useState(1)
  const [panel, setPanel] = useState(false)
  const [confirm, setConfirm] = useState(false)

  return (
    <>
      <PageHeader
        title="UI kit"
        description="DesignCode UI dark glass components, spacing, and typography."
        side={
          <>
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setPanel((p) => !p)}>Toggle side panel</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-6 items-start">
        <Card title="Buttons & badges">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" icon="plus">With icon</Button>
            <Button variant="ghost" size="sm" icon="reset">Compact utility</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <IconButton icon="settings" label="Settings" />
            <IconButton icon="settings" label="Selected" selected />
            <IconButton icon="trash" label="Disabled" disabled />
            <Switch label="demo" checked={on} onChange={setOn} />
            <Switch label="off" checked={false} />
            <Switch label="disabled" checked disabled />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge type="active" />
            <Badge type="empty" />
            <Badge type="not-found" />
            <Badge type="running" />
            <UiBadge>Unsaved</UiBadge>
            <UiBadge variant="destructive">Error</UiBadge>
            <KeyCombo keys={['Ctrl', 'Shift', 'Left']} />
          </div>
        </Card>
        <Card title="Inputs">
          <Slider label="Double-click speed" min={0} max={100} value={v} onChange={setV} format={(x) => `${x} %`} />
          <Slider label="Step size (stops)" min={1} max={5} step={1} value={stepsV} onChange={setStepsV} format={(x) => `${x} notches`} />
          <Slider label="Disabled" min={0} max={100} value={60} onChange={() => {}} disabled />
          <Dropdown aria-label="Control" value={dd} options={OPTIONS} onChange={setDd} />
          <SegmentedControl aria-label="Slot type" value={seg} options={KINDS} onChange={setSeg} />
          <TextInput label="Name" value={text} onChange={setText} />
          <TextInput label="Name" value="Brush size" onChange={() => {}} error="Name already in use" />
        </Card>
        <Card title="Shortcut recorder">
          <ShortcutRecorder aria-label="Empty" value={empty} onChange={setEmpty} />
          <ShortcutRecorder aria-label="Recorded" value={keys} onChange={setKeys} onClear={() => setKeys(null)} />
          <ShortcutRecorder aria-label="Conflict" value={['Ctrl', 'Shift', '[']} onChange={() => {}} conflict="Already used by Brush size" />
        </Card>
        <Card title="Rows">
          <ListGroup className="gap-1.5">
            {['Photoshop', 'Figma', 'Blender'].map((n, i) => (
              <ListRow key={n} icon="apps-folder" title={n} subtitle="8 shortcuts" trailing={i === 2 ? <Badge type="not-found" /> : 'chevron'} selected={sel === i} onClick={() => setSel(i)} error={i === 2} />
            ))}
            <ListRow icon="apps-folder" title="Disabled" subtitle="8 shortcuts" trailing="chevron" disabled onClick={() => {}} />
          </ListGroup>
          <MacroStepRow icon="keyboard" type="Press" value="Ctrl + Shift + S" onDelete={() => {}} />
          <MacroStepRow icon="keyboard" type="Press" value="Dragging" dragging />
        </Card>
        <Card title="Readout + toast">
          <ReadoutPill readout={{ kind: 'value', icon: 'volume', label: 'Volume', value: '45%', percent: 45 }} />
          <ReadoutPill readout={{ kind: 'message', icon: 'macros', label: 'Running', value: 'Export for web', percent: null }} />
          <ReadoutPill readout={{ kind: 'warning', icon: 'warning', label: 'Photoshop not in front', value: 'Knob → Volume', percent: null }} />
          <div><Toast message="Saved" /></div>
        </Card>
      </div>
      {panel && (
        <div className="absolute right-0 top-0 bottom-0 z-40">
          <SidePanel
            title="Edit slot"
            onClose={() => setPanel(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setPanel(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setPanel(false)}>Save</Button>
              </>
            }
          >
            <TextInput label="Name" value={text} onChange={setText} />
            <ShortcutRecorder aria-label="Left shortcut" value={keys} onChange={setKeys} />
          </SidePanel>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete Export macro?"
        description="It is used in Slot 7; that place will be emptied."
        confirmLabel="Delete"
        onConfirm={() => setConfirm(false)}
      />
    </>
  )
}
