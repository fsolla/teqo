'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'

const formatMunicipalityCount = (count: number): string => {
  if (count === 1) return '1 município'
  return `${count} municípios`
}

export const HomeSearchAdvisorGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { advisors } = results.data
  if (advisors.length === 0) return null

  return (
    <section aria-label="Assessores" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Assessores
      </h2>
      <ul className="flex flex-col">
        {advisors.map((hit) => (
          <li key={hit.id}>
            <HomeSearchHitRow
              href={`/campanha/assessores/${hit.id}`}
              primary={hit.name}
              secondary={formatMunicipalityCount(hit.municipalityCount)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
