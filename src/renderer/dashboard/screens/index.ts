import type { ComponentType } from 'react'
import { Gestures } from './Gestures'
import { Home } from './Home'
import { Kit } from './Kit'
import { Apps } from './Apps'
import { FirstRun } from './FirstRun'
import { MainDial } from './MainDial'
import { Macros } from './Macros'
import { Settings } from './Settings'
import { Test } from './Test'
import type { ScreenId, ScreenProps } from './types'
import './screens-b.css'

export type { ScreenId, ScreenProps } from './types'
export { SCREEN_IDS } from './types'

/** Screen registry. */
export const SCREENS: Record<ScreenId, ComponentType<ScreenProps>> = {
  home: Home,
  'main-dial': MainDial,
  apps: Apps,
  macros: Macros,
  gestures: Gestures,
  test: Test,
  settings: Settings,
  'first-run': FirstRun,
  /** Style guide, only via ?screen=kit. */
  kit: Kit
}
