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
<<<<<<< HEAD
=======
  const { activitySlug, demandSlug, leadershipId, municipalitySlug, organizationSlug } = context
>>>>>>> 0837151 (style: Prettier on B82 files)

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
<<<<<<< HEAD
  }, [
    setContext,
    municipalitySlug,
    municipalityId,
    leadershipId,
    organizationSlug,
    activitySlug,
    demandSlug,
  ])
=======
  }, [activitySlug, demandSlug, leadershipId, municipalitySlug, organizationSlug, setContext])
>>>>>>> 0837151 (style: Prettier on B82 files)

  return null
}
