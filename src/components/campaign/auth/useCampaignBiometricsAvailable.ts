'use client'

import { useEffect, useState } from 'react'

import { canUseCampaignBiometrics } from '@/lib/campaignWebAuthnSupport'

/**
 * Whether this browser can run a platform ceremony, resolved after mount
 * because the probe is async and the server cannot answer it. Starts `false` so
 * nothing biometric renders during hydration on a device that has no
 * authenticator; the cancellation guard is the reason this is shared rather than
 * written per island (B40 has two).
 */
export const useCampaignBiometricsAvailable = (): boolean => {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    void canUseCampaignBiometrics().then((supported) => {
      if (active) setAvailable(supported)
    })
    return () => {
      active = false
    }
  }, [])

  return available
}
