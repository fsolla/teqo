'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchActivityGroupHasHits } from '@/lib/campaignHomeSearchHits'

export const HomeSearchActivityGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null
  if (!homeSearchActivityGroupHasHits(results.data)) return null

  const { activities } = results.data

  return (
    <section aria-label="Atividades" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Atividades
      </h2>
      <ul className="flex flex-col">
        {activities.map((hit) => (
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
