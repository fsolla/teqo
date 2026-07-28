import {
  MAX_STATE_DEPUTIES_PER_MUNICIPALITY,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
} from '@/lib/schemas/municipality'

/**
 * Returns the next state-deputy-id list for a município after applying one
 * membership change, or `null` when the município is already in the desired
 * state (no write needed). Mirrors `nextAdvisorIdsAfterMembership` — the pure
 * delta calculator for the other side of a relation edited by chip+batch
 * (B37's `municipality.stateDeputies`, edited from the "Municípios" column of
 * `/campanha/dobradinhas`, which writes the município side of the relation
 * a `stateDeputy` chip in a batch touches).
 */
export const nextStateDeputyIdsAfterMunicipalityMembership = (
  currentStateDeputyIDs: readonly number[],
  stateDeputyId: number,
  assigned: boolean,
): number[] | null => {
  const alreadyAssigned = currentStateDeputyIDs.includes(stateDeputyId)
  if (assigned === alreadyAssigned) return null

  if (assigned) {
    if (currentStateDeputyIDs.length >= MAX_STATE_DEPUTIES_PER_MUNICIPALITY) {
      throw new Error(MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE)
    }
    return [...currentStateDeputyIDs, stateDeputyId]
  }
  return currentStateDeputyIDs.filter((id) => id !== stateDeputyId)
}
