import { homeSearchQueryIsActive } from '@/lib/campaignHomeSearchContract'
import { normalizeHomeSearchName } from '@/lib/homeSearchMunicipalityMatch'
import { matchesNormalizedAtWordStart } from '@/lib/wordStartFilter'

/**
 * Picks a word-start query that matches `targetName` but not `excludeName`.
 * Portfolio scoping specs allocate two municipalities per test; sharing the
 * first token (e.g. Nova Soure vs Nova Canaã) makes advisor assertions flaky.
 */
export function distinctWordStartQuery(targetName: string, excludeName: string): string {
  const normalizedTarget = normalizeHomeSearchName(targetName)
  const normalizedExclude = normalizeHomeSearchName(excludeName)

  for (const word of targetName.split(/\s+/)) {
    const query = word.trim()
    if (!homeSearchQueryIsActive(normalizeHomeSearchName(query))) continue
    const normalizedQuery = normalizeHomeSearchName(query)
    if (
      matchesNormalizedAtWordStart(normalizedTarget, normalizedQuery) &&
      !matchesNormalizedAtWordStart(normalizedExclude, normalizedQuery)
    ) {
      return query
    }
  }

  throw new Error(`No word-start query matches "${targetName}" without matching "${excludeName}"`)
}
