import {
  LEADERSHIP_MUNICIPALITY_CAP_MESSAGE,
  LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE,
  MAX_LEADERSHIP_MUNICIPALITIES,
} from '@/lib/schemas/leadership'

/**
 * Returns the next municipality-id list after adding or removing a set of
 * municipalities, plus the ids the write actually touches: `added` (what the
 * caller scope-checks) and `changed` (what it revalidates — a requested id that
 * was already in the desired state should not bust its route's cache). `null`
 * when the leadership is already in the desired state
 * (no write needed). Sibling of `nextStateDeputyIdsAfterMembership`, with two
 * differences that come from the relation itself, not from taste: the change may
 * carry a whole território/ZE at once (a set, not one id), and
 * `leadership.municipalities` has a **floor of one** — the same invariant
 * `requireAtLeastOneMunicipality` enforces in the collection, refused here too
 * so the client cannot reach a state the collection would reject.
 */
export const nextMunicipalityIdsAfterLeadershipMembership = (
  currentMunicipalityIDs: readonly number[],
  municipalityIDs: readonly number[],
  assigned: boolean,
): { next: number[]; added: number[]; changed: number[] } | null => {
  const current = new Set(currentMunicipalityIDs)
  const requested = new Set(municipalityIDs)

  if (assigned) {
    const added = [...requested].filter((id) => !current.has(id))
    if (added.length === 0) return null

    const next = [...currentMunicipalityIDs, ...added]
    if (next.length > MAX_LEADERSHIP_MUNICIPALITIES) {
      throw new Error(LEADERSHIP_MUNICIPALITY_CAP_MESSAGE)
    }
    return { next, added, changed: added }
  }

  const next = currentMunicipalityIDs.filter((id) => !requested.has(id))
  if (next.length === currentMunicipalityIDs.length) return null
  if (next.length === 0) throw new Error(LEADERSHIP_MUNICIPALITY_FLOOR_MESSAGE)
  return { next, added: [], changed: currentMunicipalityIDs.filter((id) => requested.has(id)) }
}
