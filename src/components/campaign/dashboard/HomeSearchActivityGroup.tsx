'use client'

import { useHomeSearchHitLimit } from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchActivityGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { sliceHomeSearchHits } from '@/lib/homeSearchHitBudget'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

export const HomeSearchActivityGroup = () => {
  const { results } = useHomeSearchResults()
  const hitLimit = useHomeSearchHitLimit('activities')

  if (results.status !== 'success') return null
  if (!homeSearchActivityGroupHasHits(results.data)) return null

  const { activities } = results.data
  const visibleActivities = sliceHomeSearchHits(activities, hitLimit)
  if (visibleActivities.length === 0) return null

  return (
    <section aria-label="Atividades" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Atividades</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {visibleActivities.map((hit) => (
          <li key={hit.id}>
            <HomeSearchHitRow
              href={`/campanha/atividades/${hit.slug}`}
              primary={hit.title}
              secondary={hit.secondary}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
