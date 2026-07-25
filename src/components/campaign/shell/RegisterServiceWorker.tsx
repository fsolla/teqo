'use client'

import { useEffect } from 'react'

import { CAMPAIGN_PWA_SCOPE, CAMPAIGN_PWA_SW_PATH } from '@/utilities/campaignPwa'

export const RegisterServiceWorker = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker
      .register(CAMPAIGN_PWA_SW_PATH, { scope: CAMPAIGN_PWA_SCOPE })
      .catch(() => {
        // Registration failures must never break the campaign UI.
      })
  }, [])

  return null
}
