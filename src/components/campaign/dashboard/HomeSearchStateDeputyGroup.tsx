'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import {
  formatHomeSearchMunicipalityCount,
  homeSearchStateDeputyGroupHasHits,
} from '@/lib/campaignHomeSearchHits'

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

  if (results.status !== 'success') return null

  const { stateDeputies } = results.data
  if (!homeSearchStateDeputyGroupHasHits(results.data)) return null

  return (
    <section aria-label="Dobradinhas" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Dobradinhas
      </h2>
      <ul className="flex flex-col">
        {stateDeputies.map((hit) => (
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
