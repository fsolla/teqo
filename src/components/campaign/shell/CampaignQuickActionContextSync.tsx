'use client'

import { useEffect } from 'react'

import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import {
  emptyCampaignQuickActionContext,
  type CampaignQuickActionContext,
} from '@/lib/campaignQuickActionContext'

/** RSC pages push route context into the B79 drawer host (B80+). */
export const CampaignQuickActionContextSync = ({
  municipalitySlug,
  municipalityId,
  leadershipId,
  organizationSlug,
  activitySlug,
  demandSlug,
}: CampaignQuickActionContext) => {
  const { setContext } = useCampaignQuickActionContext()

  useEffect(() => {
    setContext({
      municipalitySlug,
      municipalityId,
      leadershipId,
      organizationSlug,
      activitySlug,
      demandSlug,
    })
    return () => setContext(emptyCampaignQuickActionContext())
  }, [
    setContext,
    municipalitySlug,
    municipalityId,
    leadershipId,
    organizationSlug,
    activitySlug,
    demandSlug,
  ])

  return null
}
