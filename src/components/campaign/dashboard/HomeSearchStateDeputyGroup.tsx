'use client'

import { useHomeSearchHitLimit } from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import {
  formatHomeSearchMunicipalityCount,
  homeSearchStateDeputyGroupHasHits,
} from '@/lib/campaignHomeSearchHits'
import { sliceHomeSearchHits } from '@/lib/homeSearchHitBudget'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

const formatStateDeputySecondary = (
  party: string | null,
  municipalityCount: number,
): string | undefined => {
  const parts: string[] = []
  if (party) parts.push(party)
  if (municipalityCount > 0) parts.push(formatHomeSearchMunicipalityCount(municipalityCount))
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export const HomeSearchStateDeputyGroup = () => {
  const { results } = useHomeSearchResults()
  const hitLimit = useHomeSearchHitLimit('stateDeputies')

  if (results.status !== 'success') return null

  const { stateDeputies } = results.data
  if (!homeSearchStateDeputyGroupHasHits(results.data)) return null

  const visibleStateDeputies = sliceHomeSearchHits(stateDeputies, hitLimit)
  if (visibleStateDeputies.length === 0) return null

  return (
    <section aria-label="Dobradinhas" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Dobradinhas</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {visibleStateDeputies.map((hit) => (
          <li key={`state-deputy-${hit.slug}`}>
            <HomeSearchHitRow
              href={`/campanha/dobradinhas/${hit.slug}`}
              primary={hit.name}
              secondary={formatStateDeputySecondary(hit.party, hit.municipalityCount)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
