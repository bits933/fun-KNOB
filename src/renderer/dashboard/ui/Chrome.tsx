import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@renderer/icons/Icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { cn } from '../lib/utils'
import { IconButton } from './Button'
import { Switch } from './Switch'

/**
 * Custom window title bar (44 px). The bar is a drag region; the two buttons are not.
 */
export function TitleBar({ onMinimize, onClose }: { onMinimize: () => void; onClose: () => void }): React.JSX.Element {
  return (
    <div className="k-titlebar flex items-center justify-between shrink-0 h-11 pl-4 pr-2.5 border-b border-[#1c1c1c] bg-[#0b0d11] backdrop-blur-xl select-none">
      <div className="k-titlebar__title flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
        <span className="k-mark k-mark--sm" />
        <span>Kreo Dial</span>
      </div>
      <div className="k-titlebar__ctrl flex items-center gap-1">
        <IconButton icon="minimize" label="Minimize" iconSize={16} className="h-8 w-8 rounded-lg" onClick={onMinimize} />
        <IconButton
          icon="x"
          label="Close"
          iconSize={16}
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-destructive/18 hover:text-destructive"
        />
      </div>
    </div>
  )
}

export interface NavItemDef {
  id: string
  label: string
  icon: string
}

/** The seven dashboard sections, in rail order. */
export const NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'main-dial', label: 'Main dial', icon: 'dial' },
  { id: 'apps', label: 'Apps', icon: 'apps-folder' },
  { id: 'macros', label: 'Macros', icon: 'macros' },
  { id: 'gestures', label: 'Gestures', icon: 'gestures' },
  { id: 'test', label: 'Test', icon: 'test' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
]

export interface NavRailProps {
  /** id of the current section, or null / unknown for none. */
  selected: string | null
  onSelect: (id: string) => void
  /** App on/off, shown in the status block at the bottom ("Running" / "Paused"). */
  running: boolean
  onToggleRunning: (next: boolean) => void
  items?: NavItemDef[]
  /** Whether the sidebar is collapsed to an icon-only rail (68 px vs 228 px). */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * Collapsible DesignCode UI frosted-glass navigation rail (228 px expanded / 68 px collapsed).
 */
export function NavRail({
  selected,
  onSelect,
  running,
  onToggleRunning,
  items = NAV_ITEMS,
  collapsed = false,
  onToggleCollapse
}: NavRailProps): React.JSX.Element {
  const statusText = running ? 'Running — click to pause' : 'Paused — click to resume'
  return (
    <nav
      className={cn(
        'k-nav k-side-theme flex flex-col shrink-0 overflow-hidden border-r border-[#1f1f1f] bg-[#111111] transition-[width] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'w-[68px]' : 'w-[228px]'
      )}
      aria-label="Sections"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        className={cn(
          'flex items-center shrink-0 h-12 mb-2.5 border-b border-[#1c1c1c]',
          collapsed ? 'justify-center' : 'justify-between px-4'
        )}
      >
        {!collapsed && (
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-subtle-foreground whitespace-nowrap select-none">
            Navigation
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              icon="chevron-left"
              iconSize={18}
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className={cn(
                'w-8 h-8 rounded-lg text-subtle-foreground hover:text-foreground hover:bg-white/[0.08] [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out motion-reduce:[&_svg]:transition-none',
                collapsed && '[&_svg]:rotate-180'
              )}
              onClick={() => onToggleCollapse?.()}
            />
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className={cn('k-nav__list flex flex-col', collapsed ? 'items-center gap-1.5 px-2.5' : 'gap-1 px-3')}>
        {items.map((it) => {
          const active = it.id === selected
          const button = (
            <button
              key={it.id}
              type="button"
              className={cn(
                'k-nav__item flex items-center shrink-0 border shadow-none transition-[background-color,color,border-color] duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:border-active-border',
                collapsed
                  ? 'w-11 h-11 rounded-xl justify-center'
                  : 'h-[42px] px-3.5 gap-3 rounded-xl text-[14px] text-left whitespace-nowrap',
                active
                  ? 'text-accent-foreground font-medium bg-primary/14 border-transparent'
                  : 'border-transparent text-muted-foreground font-normal hover:text-foreground hover:bg-[#1a1a1a]'
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={collapsed ? it.label : undefined}
              onClick={() => onSelect(it.id)}
            >
              <Icon name={it.icon} size={collapsed ? 21 : 19} className="shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </button>
          )

          if (collapsed) {
            return (
              <Tooltip key={it.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{it.label}</TooltipContent>
              </Tooltip>
            )
          }

          return button
        })}
      </div>

      {collapsed ? (
        <div className="k-nav__status mt-auto shrink-0 flex justify-center py-3.5 border-t border-[#1c1c1c]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={statusText}
                aria-pressed={running}
                onClick={() => onToggleRunning(!running)}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center border border-[#222222] bg-[#161616] hover:bg-[#1e1e1e] shadow-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:border-active-border',
                  running ? 'text-accent-foreground' : 'k-dot--warn text-warning'
                )}
              >
                <Icon name="power" size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{statusText}</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="k-nav__status mt-auto shrink-0 p-3.5 border-t border-[#1c1c1c]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#161616] border border-[#222222] shadow-none">
            <span
              className={cn(
                'k-dot h-2.5 w-2.5 rounded-full shrink-0',
                running ? 'bg-accent-foreground' : 'k-dot--warn bg-warning'
              )}
            />
            <span className="k-nav__label flex-1 min-w-0 text-[14px] font-medium text-foreground truncate whitespace-nowrap">
              {running ? 'Running' : 'Paused'}
            </span>
            <Switch label="Run Kreo Dial" checked={running} onChange={onToggleRunning} />
          </div>
        </div>
      )}
    </nav>
  )
}

export interface SidePanelProps {
  title: string
  onClose: () => void
  /** Buttons for the footer (e.g. Cancel + Save), right-aligned. Omit for no footer. */
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Always on screen: no close button, no Escape, no slide-in; the body blurs in when the panel remounts. */
  pinned?: boolean
}

/**
 * 380 px DesignCode UI frosted-glass detail panel that slides in from the right.
 */
export function SidePanel({ title, onClose, footer, children, className, pinned }: SidePanelProps): React.JSX.Element {
  useEffect(() => {
    if (pinned) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Let any open Radix popover/dialog or active shortcut/macro recorder close first.
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="alertdialog"], [role="dialog"], [data-recording="true"]')) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, pinned])

  return (
    <aside
      className={cn(
        'k-panel k-side-theme flex flex-col w-[380px] h-full min-h-0 overflow-x-hidden bg-[#111111] border-l border-[#1f1f1f] shadow-[-12px_0_36px_rgba(0,0,0,0.45)]',
        pinned && 'k-panel--pinned',
        className
      )}
      aria-label={title}
    >
      <div className="k-panel__head flex items-center justify-between shrink-0 h-[60px] pl-6 pr-4 border-b border-[#1c1c1c]">
        <h2 className="k-panel__title m-0 text-[17px] font-semibold tracking-[-0.01em] text-foreground truncate">{title}</h2>
        {!pinned && <IconButton icon="x" label="Close panel" iconSize={17} onClick={onClose} />}
      </div>
      <div className={cn('k-panel__body flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-6 p-6', pinned && 'k-swap')}>{children}</div>
      {footer && (
        <div className="k-panel__foot flex items-center justify-end gap-3 shrink-0 h-[76px] px-6 border-t border-[#1c1c1c] bg-[#111111]">
          {footer}
        </div>
      )}
    </aside>
  )
}
