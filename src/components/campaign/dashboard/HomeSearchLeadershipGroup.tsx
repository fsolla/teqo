'use client'

import { useHomeSearchHitLimit } from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchWhatsAppAction } from '@/components/campaign/dashboard/HomeSearchWhatsAppAction'
import { homeSearchLeadershipGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { sliceHomeSearchHits } from '@/lib/homeSearchHitBudget'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

export const HomeSearchLeadershipGroup = () => {
  const { results } = useHomeSearchResults()
  const hitLimit = useHomeSearchHitLimit('leaderships')

  if (results.status !== 'success') return null

  const { leaderships } = results.data
  if (!homeSearchLeadershipGroupHasHits(results.data)) return null

  const visibleLeaderships = sliceHomeSearchHits(leaderships, hitLimit)
  if (visibleLeaderships.length === 0) return null

  return (
    <section aria-label="Lideranças" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Lideranças</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {visibleLeaderships.map((hit) => (
          <li key={`leadership-${hit.id}`}>
            <HomeSearchHitRow
              href={`/campanha/liderancas/${hit.id}`}
              primary={hit.name}
              secondary={hit.municipalitiesSummary || undefined}
              trailingAction={<HomeSearchWhatsAppAction phone={hit.phone} contactName={hit.name} />}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
