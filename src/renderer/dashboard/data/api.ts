import type { KreoApi } from '@shared/api'
import { createMockApi } from './mock'

/** The bridge to the main process: `window.kreo` in the app, an in-memory mock when it is missing. */
export const api: KreoApi = typeof window !== 'undefined' && window.kreo ? window.kreo : createMockApi(new URLSearchParams(window.location.search))
