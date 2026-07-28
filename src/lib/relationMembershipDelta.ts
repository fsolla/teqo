/**
 * Returns the next id list after applying ONE membership change to a bounded
 * relation, or `null` when the owner is already in the desired state (no write
 * needed) — the shape every chip-toggled relation in `/campanha` needs before
 * it writes: `municipality.advisors` (B19/B27), `leadership.stateDeputies`
 * (B31/B36) and `municipality.stateDeputies` (B37).
 *
 * The cap travels as data because that is the only thing that differs between
 * them, and its `message` is a constant owned by the relation's schema rather
 * than a literal: `mapCampaignFormActionError` matches thrown messages against
 * `safeMessages` by exact string, so a reworded throw would silently collapse
 * a real refusal into the generic "tente novamente".
 *
 * Not the batch sibling: `nextMunicipalityIdsAfterLeadershipMembership` moves a
 * whole território at once and enforces a floor, so it reports `added`/`changed`
 * instead of just the next list.
 */
export const nextIdsAfterMembership = (
  currentIDs: readonly number[],
  id: number,
  assigned: boolean,
  cap: { max: number; message: string },
): number[] | null => {
  const alreadyAssigned = currentIDs.includes(id)
  if (assigned === alreadyAssigned) return null

  if (assigned) {
    if (currentIDs.length >= cap.max) throw new Error(cap.message)
    return [...currentIDs, id]
  }
  return currentIDs.filter((currentId) => currentId !== id)
}
