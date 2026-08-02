'use client'

import { useMemo } from 'react'

import { useHomeSearchHitLimit } from '@/components/campaign/dashboard/HomeSearchHitBudgetContext'
import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchMunicipalityVoteTrailing } from '@/components/campaign/dashboard/HomeSearchMunicipalityVoteTrailing'
import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { useHomeSearchNearestMunicipality } from '@/components/campaign/dashboard/useHomeSearchNearestMunicipality'
import {
  homeSearchMunicipalityGroupHasHits,
  toHomeSearchMunicipalityHit,
  type HomeSearchScopeMunicipality,
} from '@/lib/campaignHomeSearchHits'
import { formatElectionNumber } from '@/lib/electionFormat'
import { mergeHomeSearchNearestMunicipality } from '@/lib/homeSearchNearestMunicipalityMerge'
import { sliceHomeSearchMunicipalityGroup } from '@/lib/homeSearchHitBudget'
import { HOME_SEARCH_GROUP_HEADING_CLASS, HOME_SEARCH_GROUP_LIST_CLASS } from '@/lib/homeSearchUi'
import type { AccessibleMunicipality } from '@/lib/municipalityProximity'
import { buildTerritoryPageHref } from '@/lib/territoryAnchor'

const scopeToAccessible = (scope: readonly HomeSearchScopeMunicipality[]): AccessibleMunicipality[] =>
  scope.map(({ slug, name, ibgeCode }) => ({ slug, name, ibgeCode }))

const buildHitBySlug = (scope: readonly HomeSearchScopeMunicipality[]) =>
  new Map(scope.map((doc) => [doc.slug, toHomeSearchMunicipalityHit(doc)]))

export const HomeSearchMunicipalityGroup = () => {
  const { query, uiFocused } = useHomeSearch()
  const { results, resultKind } = useHomeSearchResults()
  const hitLimit = useHomeSearchHitLimit('municipalities')

  const suggestMode = uiFocused && !query.isActive

  const scopeMunicipalities = useMemo(
    () => (results.status === 'success' ? results.data.scopeMunicipalities ?? [] : []),
    [results],
  )

  const accessible = useMemo(() => scopeToAccessible(scopeMunicipalities), [scopeMunicipalities])
  const hitBySlug = useMemo(() => buildHitBySlug(scopeMunicipalities), [scopeMunicipalities])

  const nearestSlug = useHomeSearchNearestMunicipality(
    accessible,
    suggestMode && scopeMunicipalities.length > 0,
  )

  if (results.status !== 'success') return null

  const { municipalities, territories } = results.data
  if (!homeSearchMunicipalityGroupHasHits(results.data)) return null

  const mergedMunicipalities =
    resultKind === 'suggest'
      ? mergeHomeSearchNearestMunicipality({
          nearestSlug,
          serverHits: municipalities,
          hitBySlug,
        })
      : municipalities

  const includeTerritories = resultKind === 'search'
  const { municipalities: visibleMunicipalities, territories: visibleTerritories } =
    sliceHomeSearchMunicipalityGroup(mergedMunicipalities, territories, hitLimit, includeTerritories)

  if (visibleMunicipalities.length === 0 && visibleTerritories.length === 0) return null

  const sectionTitle = resultKind === 'suggest' ? 'Sugestões' : 'Municípios'
  const showHeading = resultKind !== 'suggest'

  return (
    <section aria-label={sectionTitle} className="flex flex-col gap-0.5">
      {showHeading ? <h2 className={HOME_SEARCH_GROUP_HEADING_CLASS}>{sectionTitle}</h2> : null}
      <ul className={HOME_SEARCH_GROUP_LIST_CLASS}>
        {visibleMunicipalities.map((hit) => (
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
        {includeTerritories
          ? visibleTerritories.map((hit) => (
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
