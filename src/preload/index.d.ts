import type { BorisAPI } from '@shared/types'

declare global {
  interface Window {
    /** Absent hors coquille Electron. */
    boris: BorisAPI
  }
}

export {}
