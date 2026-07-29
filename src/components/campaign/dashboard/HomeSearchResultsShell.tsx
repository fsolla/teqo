'use client'

import type { ReactNode } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchMunicipalityGroupHasHits } from '@/lib/campaignHomeSearchHits'

export const HomeSearchResultsShell = ({ children }: { children: ReactNode }) => {
  const { query } = useHomeSearch()
  const { results } = useHomeSearchResults()

  const showEmpty =
    query.isActive &&
    results.status === 'success' &&
    !homeSearchMunicipalityGroupHasHits(results.data)

  const showError = results.status === 'error'
  const errorMessage = results.status === 'error' ? results.message : null

  return (
    <>
      {children}
      {showError && errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {showEmpty ? <p className="text-sm text-muted-foreground">Nenhum resultado.</p> : null}
    </>
  )
}
