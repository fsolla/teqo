'use client'

import type { ReactNode } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchMunicipalityGroupHasHits } from '@/lib/campaignHomeSearchHits'

export const HomeSearchResultsShell = ({ children }: { children: ReactNode }) => {
  const { query } = useHomeSearch()
  const { results, resultKind } = useHomeSearchResults()

  const showEmpty =
    query.isActive &&
    resultKind === 'search' &&
    results.status === 'success' &&
    !homeSearchMunicipalityGroupHasHits(results.data)

  return (
    <>
      {children}
      {results.status === 'error' ? (
        <p className="text-sm text-destructive" role="alert">
          {results.message}
        </p>
      ) : null}
      {showEmpty ? <p className="text-sm text-muted-foreground">Nenhum resultado.</p> : null}
    </>
  )
}
