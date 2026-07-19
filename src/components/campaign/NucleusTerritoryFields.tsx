'use client'

import { CampaignTerritoryCoreFields } from '@/components/campaign/CampaignTerritoryCoreFields'
import {
  useCampaignTerritoryFieldsState,
  type CampaignTerritoryValues,
} from '@/components/campaign/useCampaignTerritoryFieldsState'

/**
 * Territory-only fields (regions/cities/neighborhoods) shared by any campaign
 * form that needs Bahia territory selection without TSE zones — see
 * `NucleusTerritoryAndZonesFields` for the nucleus variant that also manages
 * TSE zones.
 */
export const CampaignTerritoryFields = ({
  values,
  fieldErrors = {},
}: {
  values?: CampaignTerritoryValues
  fieldErrors?: Record<string, string[]>
}) => {
  const state = useCampaignTerritoryFieldsState(values)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampaignTerritoryCoreFields state={state} idPrefix="plan" fieldErrors={fieldErrors} />
    </div>
  )
}
