/**
 * Dashboard UI kit. Import from here: `import { Button, Card, Switch, ConfirmDialog } from '../ui'`.
 * Styles live in ./ui.css and ./extras.css (wrapped in @layer components so Tailwind utilities take precedence).
 */
import './ui.css'
import './extras.css'

export { Button, IconButton } from './Button'
export type { ButtonProps, IconButtonProps } from './Button'
export { Switch } from './Switch'
export type { SwitchProps } from './Switch'
export { Slider } from './Slider'
export type { SliderProps } from './Slider'
export { Dropdown } from './Dropdown'
export type { DropdownProps, Option } from './Dropdown'
export { SegmentedControl } from './SegmentedControl'
export type { SegmentedControlProps } from './SegmentedControl'
export { PositionGrid, POSITIONS } from './PositionGrid'
export type { Position } from './PositionGrid'
export { TextInput } from './TextInput'
export type { TextInputProps } from './TextInput'
export { ShortcutRecorder, KeyChip, KeyCombo } from './ShortcutRecorder'
export type { ShortcutRecorderProps } from './ShortcutRecorder'
export { Card, CardBody, PageHeader, Banner } from './Card'
export type { CardProps } from './Card'
export { ListRow, ListGroup, Badge, MacroStepRow } from './ListRow'
export type { ListRowProps, BadgeType, MacroStepRowProps } from './ListRow'
export { TitleBar, NavRail, NAV_ITEMS, SidePanel } from './Chrome'
export type { NavRailProps, NavItemDef, SidePanelProps } from './Chrome'
export { Toast, useToast } from './Toast'
export { DialPreview, ReadoutPill } from './DialPreview'
export type { DialPreviewProps } from './DialPreview'
export { DialPicker } from './DialPicker'
export type { DialPickerProps } from './DialPicker'
export { IconPicker } from './IconPicker'
export type { IconPickerProps } from './IconPicker'
export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'
export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'
export { useFadeRemove } from './useFadeRemove'
export { cx } from './cx'

// shadcn/ui primitives for direct composition in dashboard screens
export { buttonVariants } from '../components/ui/button'
export { Badge as UiBadge, badgeVariants } from '../components/ui/badge'
export {
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter
} from '../components/ui/card'
export { Separator } from '../components/ui/separator'
export { Label } from '../components/ui/label'
export { Input } from '../components/ui/input'
export { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip'
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from '../components/ui/popover'
export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from '../components/ui/alert-dialog'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
} from '../components/ui/table'
