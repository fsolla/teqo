'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

import {
  CAMPAIGN_PUSH_ACTIVATED_MESSAGE,
  CAMPAIGN_PUSH_OPT_IN_ACCEPT_LABEL,
  CAMPAIGN_PUSH_OPT_IN_TOAST_DESCRIPTION,
  CAMPAIGN_PUSH_OPT_IN_TOAST_TITLE,
} from '@/lib/campaignNotificationCopy'
import {
  activateCampaignPushOnDevice,
  dismissCampaignPushOptIn,
  isIosSafari,
  isStandaloneDisplay,
  readCampaignPushSubscription,
  supportsCampaignPush,
  wasCampaignPushOptInDismissed,
} from '@/utilities/campaignPushClient'

const TOAST_ID = 'campaign-push-opt-in'

export type CampaignPushOptInOffer = {
  pushConsentConfigured: boolean
  vapidPublicKey: string | null
}

/**
 * Discovery for push notifications, modeled on `InstallPwaToast` and
 * `BiometricEnrollmentToast`: nobody opens the profile looking for a feature
 * they have never heard of. Shows once, while the browser still CAN ask
 * (`Notification.permission === 'default'`) — never for 'denied' (a denied
 * permission cannot be re-prompted by any API) and never on iOS before the
 * PWA is installed, where the request is silently ignored. Dismissed offers
 * stay dismissed per device (localStorage); the permanent home stays the
 * profile card.
 */
export const CampaignPushOptInToast = ({
  pushConsentConfigured,
  vapidPublicKey,
}: CampaignPushOptInOffer) => {
  useEffect(() => {
    if (!pushConsentConfigured || !vapidPublicKey) return
    if (!supportsCampaignPush()) return
    if (Notification.permission !== 'default') return
    if (wasCampaignPushOptInDismissed()) return
    if (isIosSafari() && !isStandaloneDisplay()) return

    let cancelled = false

    const offer = async () => {
      // First statement, before any await: the native prompt must be
      // requested inside the click gesture or Chrome auto-denies it silently.
      const permission = await Notification.requestPermission()
      const result = await activateCampaignPushOnDevice({
        pushConsentConfigured,
        vapidPublicKey,
        permission,
      })

      toast.dismiss(TOAST_ID)
      if (result.status === 'success') {
        dismissCampaignPushOptIn()
        toast.success(CAMPAIGN_PUSH_ACTIVATED_MESSAGE)
      } else {
        // A denied permission would deny every future attempt — stop offering.
        if (Notification.permission === 'denied') dismissCampaignPushOptIn()
        toast.error(result.message)
      }
    }

    // Same beat as the sibling toasts: let the first paint land before asking
    // for anything, and skip the offer when this device is already subscribed.
    const timer = window.setTimeout(() => {
      void readCampaignPushSubscription().then((subscription) => {
        if (cancelled || subscription) return

        toast.message(CAMPAIGN_PUSH_OPT_IN_TOAST_TITLE, {
          id: TOAST_ID,
          description: CAMPAIGN_PUSH_OPT_IN_TOAST_DESCRIPTION,
          duration: Infinity,
          closeButton: true,
          onDismiss: dismissCampaignPushOptIn,
          action: {
            label: CAMPAIGN_PUSH_OPT_IN_ACCEPT_LABEL,
            onClick: (event) => {
              // Sonner closes the toast on action unless the click is
              // defaulted-out — keeping it open lets a declined OS prompt
              // land back on a visible offer instead of vanishing.
              event.preventDefault()
              void offer()
            },
          },
        })
      })
    }, 2000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      toast.dismiss(TOAST_ID)
    }
  }, [pushConsentConfigured, vapidPublicKey])

  return null
}
