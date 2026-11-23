export type ScreenId = 'home' | 'main-dial' | 'apps' | 'macros' | 'gestures' | 'test' | 'settings' | 'first-run' | 'kit'

export const SCREEN_IDS: ScreenId[] = ['home', 'main-dial', 'apps', 'macros', 'gestures', 'test', 'settings', 'first-run', 'kit']

/** Props every screen receives. */
export interface ScreenProps {
  /** Switch to another screen (cross-fades). */
  navigate: (id: ScreenId) => void
  /** Show a short toast ("Saved"). */
  toast: (message: string, icon?: string) => void
}
