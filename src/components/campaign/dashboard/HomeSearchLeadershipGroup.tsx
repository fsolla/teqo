'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchLeadershipGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

export const HomeSearchLeadershipGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { leaderships } = results.data
  if (!homeSearchLeadershipGroupHasHits(results.data)) return null

  return (
    <section aria-label="Lideranças" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Lideranças</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
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
