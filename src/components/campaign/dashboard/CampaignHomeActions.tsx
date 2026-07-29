'use client'

import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import type { CampaignRole } from '@/lib/campaignRoles'

const homeActionsHeadingId = 'campaign-home-actions-heading'

export const CampaignHomeActions = ({
  role,
  uncoveredMunicipalitiesHref,
}: {
  role: CampaignRole
  uncoveredMunicipalitiesHref?: string
}) => {
  const actions = toHomeActionButtonProps(homeActionsForRole(role), uncoveredMunicipalitiesHref)

  if (actions.length === 0) return null

  return (
    <section aria-labelledby={homeActionsHeadingId} className="w-full">
      <h2 id={homeActionsHeadingId} className="text-base font-semibold text-foreground">
        O que você quer fazer?
      </h2>
      <CampaignHomeActionStrip actions={actions} className="mt-4 w-full" />
    </section>
  )
}
