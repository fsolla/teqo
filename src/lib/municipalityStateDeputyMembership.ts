import { nextIdsAfterMembership } from '@/lib/relationMembershipDelta'
import {
  MAX_STATE_DEPUTIES_PER_MUNICIPALITY,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/municipality'

/**
 * Returns the next state-deputy-id list for a município after applying one
 * membership change, or `null` when the município is already in the desired
 * state (no write needed) — the município side of the relation that a
 * `stateDeputy` chip batch touches (B37, from the "Municípios" column of
 * `/campanha/dobradinhas`).
 */
export const nextStateDeputyIdsAfterMunicipalityMembership = (
  currentStateDeputyIDs: readonly number[],
  stateDeputyId: number,
  assigned: boolean,
): number[] | null =>
  nextIdsAfterMembership(currentStateDeputyIDs, stateDeputyId, assigned, {
    max: MAX_STATE_DEPUTIES_PER_MUNICIPALITY,
    message: MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
  })
