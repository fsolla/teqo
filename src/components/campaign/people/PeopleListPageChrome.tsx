'use client'

import { useActivePeopleSavedFilter } from '@/components/campaign/shared/usePeopleSavedFilters'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { campaignPageChromeCatalog } from '@/lib/campaignPageChrome'

/**
 * When the current URL matches a saved people filter, the filter name becomes
 * the page subtitle (B133 pattern) — the omnibox keeps chips as the editable
 * recorte.
 */
export const PeopleListPageChrome = () => {
  const activeFilter = useActivePeopleSavedFilter()

  if (!activeFilter) return null

  return (
    <SetCampaignPageChrome
      chrome={{
        title: campaignPageChromeCatalog.pessoas.title,
        subtitle: activeFilter.name,
      }}
    />
  )
}
