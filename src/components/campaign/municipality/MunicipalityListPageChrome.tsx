'use client'

import { useActiveMunicipalitySavedFilter } from '@/components/campaign/shared/useMunicipalitySavedFilters'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { campaignPageChromeCatalog } from '@/lib/campaignPageChrome'

/**
 * When the current URL matches a saved municipality filter, the filter name
 * becomes the page subtitle (B133) — the bar keeps chips as the editable recorte.
 */
export const MunicipalityListPageChrome = () => {
  const activeFilter = useActiveMunicipalitySavedFilter()

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
