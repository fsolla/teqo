'use client'

import type { ReactNode } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchSuggestSkeleton } from '@/components/campaign/dashboard/HomeSearchSuggestSkeleton'
import { useHomeSearchResults } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { homeSearchHasAnyHits } from '@/lib/campaignHomeSearchHits'

export const HomeSearchResultsShell = ({ children }: { children: ReactNode }) => {
  const { query } = useHomeSearch()
  const { results, resultKind, isFetching } = useHomeSearchResults()

  const hasRenderableHits =
    results.status === 'success' && homeSearchHasAnyHits(results.data)
  const showSkeleton = isFetching && !hasRenderableHits && results.status !== 'error'

  const showEmpty =
    query.isActive &&
    resultKind === 'search' &&
    results.status === 'success' &&
    !homeSearchHasAnyHits(results.data)

  return (
    <>
      {showSkeleton ? <HomeSearchSuggestSkeleton /> : null}
      {!showSkeleton ? children : null}
      {results.status === 'error' ? (
        <p className="text-sm text-destructive" role="alert">
          {results.message}
        </p>
      ) : null}
      {showEmpty ? <p className="text-sm text-muted-foreground">Nenhum resultado.</p> : null}
    </>
  )
}
