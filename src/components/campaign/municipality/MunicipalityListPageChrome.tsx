'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import { useMunicipalitySavedFilters } from '@/components/campaign/shared/useMunicipalitySavedFilters'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { campaignPageChromeCatalog } from '@/lib/campaignPageChrome'
import { isSameListHref } from '@/lib/listQueryMatch'

/** A page is a position inside a recorte, not part of it (B18). */
const IGNORED_PARAMS = ['page']

/**
 * When the current URL matches a saved municipality filter, the filter name
 * becomes the page subtitle (B133) — the bar keeps chips as the editable recorte.
 */
export const MunicipalityListPageChrome = () => {
  const savedFilters = useMunicipalitySavedFilters()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeFilter = useMemo(() => {
    const query = searchParams.toString()
    const currentHref = query ? `${pathname}?${query}` : pathname
    return savedFilters.find((entry) =>
      isSameListHref(currentHref, entry.href, IGNORED_PARAMS),
    )
  }, [pathname, searchParams, savedFilters])

  if (!activeFilter) return null

  return (
    <SetCampaignPageChrome
      chrome={{
        title: campaignPageChromeCatalog.municipios.title,
        subtitle: activeFilter.name,
      }}
    />
  )
}
