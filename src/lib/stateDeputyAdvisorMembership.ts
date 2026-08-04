import { nextIdsAfterMembership } from '@/lib/relationMembershipDelta'
import {
  MAX_ADVISORS_PER_STATE_DEPUTY,
  STATE_DEPUTY_ADVISORS_CAP_MESSAGE,
} from '@/lib/schemas/stateDeputy'

/**
 * Returns the next advisor-id list after applying ONE membership change on
 * `StateDeputy.advisors`, or `null` when the dobradinha is already in the
 * desired state (no write needed) — the same bounded-delta contract as
 * `nextAdvisorIdsAfterMembership` (municipality) and the leadership twins.
 */
export const nextStateDeputyAdvisorIdsAfterMembership = (
  currentAdvisorIDs: readonly number[],
  advisorId: number,
  assigned: boolean,
): number[] | null =>
  nextIdsAfterMembership(currentAdvisorIDs, advisorId, assigned, {
    max: MAX_ADVISORS_PER_STATE_DEPUTY,
    message: STATE_DEPUTY_ADVISORS_CAP_MESSAGE,
  })
