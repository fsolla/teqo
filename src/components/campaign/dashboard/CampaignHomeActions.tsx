'use client'

import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignHomeActions = ({
  role,
  uncoveredMunicipalitiesHref,
}: {
  role: CampaignRole
  uncoveredMunicipalitiesHref?: string
}) => {
  const actions = toHomeActionButtonProps(homeActionsForRole(role), {
    uncoveredMunicipalitiesHref,
    returnPath: CAMPAIGN_HOME,
  })

  if (actions.length === 0) return null

  return <CampaignHomeActionStrip actions={actions} className="w-full" />
}
