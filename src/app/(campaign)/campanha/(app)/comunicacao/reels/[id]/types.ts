import type { ReelStatus } from '@/lib/reel'

/** C194 — the JSON envelope of the kill-switch route. */
export type ReelPublicationResponse =
  | {
      status: 'success'
      reel: {
        id: number
        status: ReelStatus
      }
    }
  | { status: 'error'; message: string }
