'use client'

import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import type { AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignHomeActions = ({
  role,
  editingScope = 'tudo',
  uncoveredMunicipalitiesHref,
}: {
  role: CampaignRole
  /** C142 — advisors with `somente_leitura` see only navigation actions. */
  editingScope?: AdvisorEditingScope
  uncoveredMunicipalitiesHref?: string
}) => {
  const actions = toHomeActionButtonProps(homeActionsForRole(role, editingScope), {
    uncoveredMunicipalitiesHref,
    returnPath: CAMPAIGN_HOME,
  })

  if (actions.length === 0) return null

  return <CampaignHomeActionStrip actions={actions} className="w-full" variant="responsive" />
}
