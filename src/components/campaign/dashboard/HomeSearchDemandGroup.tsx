'use client'

import { useHomeSearchHitLimit } from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchShareAction } from '@/components/campaign/dashboard/HomeSearchShareAction'
import { homeSearchDemandGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { sliceHomeSearchHits } from '@/lib/homeSearchHitBudget'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

export const HomeSearchDemandGroup = () => {
  const { results } = useHomeSearchResults()
  const hitLimit = useHomeSearchHitLimit('demands')

  if (results.status !== 'success') return null
  if (!homeSearchDemandGroupHasHits(results.data)) return null

  const { demands } = results.data
  const visibleDemands = sliceHomeSearchHits(demands, hitLimit)
  if (visibleDemands.length === 0) return null

  return (
    <section aria-label="Demandas" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Demandas</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {visibleDemands.map((hit) => (
          <li key={hit.id}>
            <HomeSearchHitRow
              href={`/campanha/demandas/${hit.slug}`}
              primary={hit.title}
              secondary={hit.secondary}
              trailingAction={
                <HomeSearchShareAction
                  title={hit.title}
                  detailPath={`/campanha/demandas/${hit.slug}`}
                />
              }
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
