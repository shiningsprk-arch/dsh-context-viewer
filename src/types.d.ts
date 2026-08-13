import type { DshBridge } from '../shared/types'

declare global {
  interface Window {
    dsh: DshBridge
  }
}

export {}
