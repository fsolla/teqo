import type { CampaignUser } from '@/payload-types'

/** Context injected into every tool execution by the route handler. */
export type AIToolContext = {
  /** The authenticated campaign user making the request. */
  user: CampaignUser
  /** The Payload instance (already initialized with config). */
  payload: import('payload').Payload
}
