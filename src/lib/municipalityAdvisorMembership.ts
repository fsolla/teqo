import { MAX_ADVISORS_PER_MUNICIPALITY } from '@/lib/schemas/municipality'

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
): number[] | null => {
  const alreadyAssigned = currentAdvisorIDs.includes(advisorId)
  if (assigned === alreadyAssigned) return null

  if (assigned) {
    if (currentAdvisorIDs.length >= MAX_ADVISORS_PER_MUNICIPALITY) {
      throw new Error(
        `Cada município aceita no máximo ${MAX_ADVISORS_PER_MUNICIPALITY} assessores.`,
      )
    }
    return [...currentAdvisorIDs, advisorId]
  }
  return currentAdvisorIDs.filter((id) => id !== advisorId)
}
