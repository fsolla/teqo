'use client'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchMunicipalityVoteTrailing } from '@/components/campaign/dashboard/HomeSearchMunicipalityVoteTrailing'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchMunicipalityGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { formatElectionNumber } from '@/lib/electionFormat'
import { buildTerritoryPageHref } from '@/lib/territoryAnchor'

export const HomeSearchMunicipalityGroup = () => {
  const { results, resultKind } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { municipalities, territories } = results.data
  if (!homeSearchMunicipalityGroupHasHits(results.data)) return null

  const sectionTitle = resultKind === 'suggest' ? 'Sugestões' : 'Municípios'

  return (
    <section aria-label={sectionTitle} className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {sectionTitle}
      </h2>
      <ul className="flex flex-col">
        {municipalities.map((hit) => (
          <li key={`municipality-${hit.slug}`}>
            <HomeSearchHitRow
              href={`/campanha/municipios/${hit.slug}`}
              primary={hit.name}
              secondary={hit.region}
              showPriority={hit.priority === 'alta'}
              trailing={<HomeSearchMunicipalityVoteTrailing position={hit.votePosition2022} />}
            />
          </li>
        ))}
        {resultKind === 'search'
          ? territories.map((hit) => (
              <li key={`territory-${hit.region}`}>
                <HomeSearchHitRow
                  href={buildTerritoryPageHref(hit.region)}
                  primary={hit.region}
                  trailing={
                    <span className="tabular-nums text-sm font-medium">
                      {formatElectionNumber(hit.votes2022)}
                    </span>
                  }
                />
              </li>
            ))
          : null}
      </ul>
    </section>
  )
}
