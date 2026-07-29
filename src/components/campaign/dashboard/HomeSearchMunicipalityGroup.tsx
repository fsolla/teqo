'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import { homeSearchMunicipalityGroupHasHits } from '@/lib/campaignHomeSearchHits'
import { formatElectionNumber } from '@/lib/electionFormat'
import { buildTerritoryPageHref } from '@/lib/territoryAnchor'
import { cn } from '@/lib/utils'

const PRIORITY_ICON_SLOT_CLASS = 'flex w-4 shrink-0 justify-center'

const HomeSearchHitRow = ({
  href,
  primary,
  secondary,
  trailing,
  showPriority,
}: {
  href: string
  primary: string
  secondary?: string
  trailing: ReactNode
  showPriority: boolean
}) => (
  <Link
    href={href}
    className={cn(
      'flex min-h-11 items-center gap-3 py-2.5 text-foreground',
      'rounded-md outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
    )}
  >
    <span className={PRIORITY_ICON_SLOT_CLASS} aria-hidden={!showPriority}>
      {showPriority ? <MunicipalityPriorityIndicator /> : null}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{primary}</span>
      {secondary ? (
        <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
      ) : null}
    </span>
    <span className="shrink-0">{trailing}</span>
  </Link>
)

export const HomeSearchMunicipalityGroup = () => {
  const { results } = useHomeSearchResults()

  if (results.status !== 'success') return null

  const { municipalities, territories } = results.data
  if (!homeSearchMunicipalityGroupHasHits(results.data)) return null

  return (
    <section aria-label="Municípios" className="flex flex-col gap-1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Municípios
      </h2>
      <ul className="flex flex-col">
        {municipalities.map((hit) => (
          <li key={`municipality-${hit.slug}`}>
            <HomeSearchHitRow
              href={`/campanha/municipios/${hit.slug}`}
              primary={hit.name}
              secondary={hit.region}
              showPriority={hit.priority === 'alta'}
              trailing={
                hit.votePosition2022 ? (
                  <MunicipalityVotePositionReadout
                    position={hit.votePosition2022}
                    layout="search"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )
              }
            />
          </li>
        ))}
        {territories.map((hit) => (
          <li key={`territory-${hit.region}`}>
            <HomeSearchHitRow
              href={buildTerritoryPageHref(hit.region)}
              primary={hit.region}
              showPriority={false}
              trailing={
                <span className="tabular-nums text-sm font-medium">
                  {formatElectionNumber(hit.votes2022)}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
