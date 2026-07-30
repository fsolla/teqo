'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { formatHomeSearchMunicipalityCount } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'

export const HomeSearchAdvisorGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { advisors } = results.data
  if (advisors.length === 0) return null

  return (
    <section aria-label="Assessores" className="flex flex-col gap-0.5">
      <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>Assessores</h2>
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {advisors.map((hit) => (
          <li key={hit.id}>
            <HomeSearchHitRow
              href={`/campanha/assessores/${hit.id}`}
              primary={hit.name}
              secondary={formatHomeSearchMunicipalityCount(hit.municipalityCount)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
