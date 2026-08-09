'use client'

import { useEffect } from 'react'

import { installCampaignIosViewportHeal } from '@/lib/campaignIosViewportHeal'

export const CampaignIosViewportHeal = () => {
  useEffect(() => {
    const teardown = installCampaignIosViewportHeal(window)
    return () => {
      teardown()
    }
  }, [])

  return null
}
