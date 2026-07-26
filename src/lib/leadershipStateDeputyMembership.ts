import { MAX_LEADERSHIP_STATE_DEPUTIES } from '@/lib/schemas/leadership'

/**
 * Returns the next state-deputy-id list after applying one membership
 * change, or `null` when the leadership is already in the desired state (no
 * write needed). Mirrors `nextAdvisorIdsAfterMembership` — the pure delta
 * calculator for the other side of a relation edited by chip+combobox
 * (B31's `leadership.stateDeputies`, edited from the "Dobradinhas" column of
 * `/campanha/liderancas`).
 */
export const nextStateDeputyIdsAfterMembership = (
  currentStateDeputyIDs: readonly number[],
  stateDeputyId: number,
  assigned: boolean,
): number[] | null => {
  const alreadyAssigned = currentStateDeputyIDs.includes(stateDeputyId)
  if (assigned === alreadyAssigned) return null

  if (assigned) {
    if (currentStateDeputyIDs.length >= MAX_LEADERSHIP_STATE_DEPUTIES) {
      throw new Error(
        `Cada liderança aceita no máximo ${MAX_LEADERSHIP_STATE_DEPUTIES} dobradinhas.`,
      )
    }
    return [...currentStateDeputyIDs, stateDeputyId]
  }
  return currentStateDeputyIDs.filter((id) => id !== stateDeputyId)
}
