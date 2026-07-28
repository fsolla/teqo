import { nextIdsAfterMembership } from '@/lib/relationMembershipDelta'
import {
  MAX_ADVISORS_PER_MUNICIPALITY,
  MUNICIPALITY_ADVISORS_CAP_MESSAGE,
} from '@/lib/schemas/municipality'

/**
 * Returns the next advisor-id list after applying one membership change, or
 * `null` when the municipality is already in the desired state (no write
 * needed). Shared by the advisor-carteira mutations (`actions/advisor.ts`)
 * and the município-side quick edit (`actions/municipality.ts`, B27) — the
 * two sides of the same `municipality.advisors` relation.
 */
export const nextAdvisorIdsAfterMembership = (
  currentAdvisorIDs: readonly number[],
  advisorId: number,
  assigned: boolean,
): number[] | null =>
  nextIdsAfterMembership(currentAdvisorIDs, advisorId, assigned, {
    max: MAX_ADVISORS_PER_MUNICIPALITY,
    message: MUNICIPALITY_ADVISORS_CAP_MESSAGE,
  })
