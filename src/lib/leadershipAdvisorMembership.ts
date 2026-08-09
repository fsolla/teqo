import { nextIdsAfterMembership } from '@/lib/relationMembershipDelta'
import { LEADERSHIP_ADVISORS_CAP_MESSAGE, MAX_LEADERSHIP_ADVISORS } from '@/lib/schemas/leadership'

/**
 * Returns the next advisor-id list after applying ONE membership change on
 * `Leadership.advisors`, or `null` when the leadership is already in the
 * desired state (no write needed) — the same bounded-delta contract as
 * `nextStateDeputyAdvisorIdsAfterMembership` (dobradinha) and the
 * municipality/leadership twins.
 */
export const nextLeadershipAdvisorIdsAfterMembership = (
  currentAdvisorIDs: readonly number[],
  advisorId: number,
  assigned: boolean,
): number[] | null =>
  nextIdsAfterMembership(currentAdvisorIDs, advisorId, assigned, {
    max: MAX_LEADERSHIP_ADVISORS,
    message: LEADERSHIP_ADVISORS_CAP_MESSAGE,
  })
