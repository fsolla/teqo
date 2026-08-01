'use client'

import { useEffect, useMemo } from 'react'

import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import {
  emptyCampaignQuickActionContext,
  type CampaignQuickActionContext,
} from '@/lib/campaignQuickActionContext'

type CampaignQuickActionContextBridgeProps = {
  municipalitySlug?: string
  activitySlug?: string
  leadershipId?: number
  organizationSlug?: string
  demandSlug?: string
}

/** Syncs page-local quick-action context into the B79 drawer host. */
export const CampaignQuickActionContextBridge = ({
  municipalitySlug,
  activitySlug,
  leadershipId,
  organizationSlug,
  demandSlug,
}: CampaignQuickActionContextBridgeProps) => {
  const { setContext } = useCampaignQuickActionContext()
  const context = useMemo((): CampaignQuickActionContext => {
    const next: CampaignQuickActionContext = {}
    if (municipalitySlug) next.municipalitySlug = municipalitySlug
    if (activitySlug) next.activitySlug = activitySlug
    if (leadershipId !== undefined) next.leadershipId = leadershipId
    if (organizationSlug) next.organizationSlug = organizationSlug
    if (demandSlug) next.demandSlug = demandSlug
    return next
  }, [activitySlug, demandSlug, leadershipId, municipalitySlug, organizationSlug])

  useEffect(() => {
    setContext(context)
    return () => {
      setContext(emptyCampaignQuickActionContext())
    }
  }, [context, setContext])

  return null
}
