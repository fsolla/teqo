import { nextIdsAfterMembership } from '@/lib/relationMembershipDelta'
import {
  LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  MAX_LEADERSHIP_STATE_DEPUTIES,
} from '@/lib/schemas/leadership'

/**
 * Returns the next state-deputy-id list after applying one membership
 * change, or `null` when the leadership is already in the desired state (no
 * write needed) — the `leadership.stateDeputies` side of the relation, edited
 * from the "Dobradinhas" column of `/campanha/liderancas` (B31) and from the
 * "Lideranças" column of `/campanha/dobradinhas` (B36).
 */
export const nextStateDeputyIdsAfterMembership = (
  currentStateDeputyIDs: readonly number[],
  stateDeputyId: number,
  assigned: boolean,
): number[] | null =>
  nextIdsAfterMembership(currentStateDeputyIDs, stateDeputyId, assigned, {
    max: MAX_LEADERSHIP_STATE_DEPUTIES,
    message: LEADERSHIP_STATE_DEPUTIES_CAP_MESSAGE,
  })
