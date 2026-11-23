/**
 * <Icon name="volume" size={24} /> renders one of the 64 icons exported from Figma.
 * Colour follows the CSS `color` of the parent (the SVGs use currentColor).
 * Owner: orchestrator.
 */
import type { CSSProperties } from 'react'

const files = import.meta.glob('./svg/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.slice('./svg/'.length, -'.svg'.length), svg])
)

export const ICON_NAMES: string[] = Object.keys(ICONS).sort()

export function Icon({
  name,
  size = 24,
  className,
  style
}: {
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}): React.JSX.Element {
  return (
    <span
      className={className ? `icon ${className}` : 'icon'}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? ICONS['empty-slot'] }}
    />
  )
}
