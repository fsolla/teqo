'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchLeadershipGroupHasHits } from '@/lib/campaignHomeSearchHits'

export const HomeSearchLeadershipGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { leaderships } = results.data
  if (!homeSearchLeadershipGroupHasHits(results.data)) return null

  return (
    <section aria-label="Lideranças" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Lideranças
      </h2>
      <ul className="flex flex-col">
        {leaderships.map((hit) => (
          <li key={`leadership-${hit.id}`}>
            <HomeSearchHitRow
              href={`/campanha/liderancas/${hit.id}`}
              primary={hit.name}
              secondary={hit.municipalitiesSummary || undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
