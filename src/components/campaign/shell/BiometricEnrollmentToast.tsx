'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

import {
  CAMPAIGN_BIOMETRIC_ENROLL_LABEL,
  CAMPAIGN_BIOMETRIC_TOAST_DESCRIPTION,
  CAMPAIGN_BIOMETRIC_TOAST_TITLE,
} from '@/lib/campaignAuthCopy'
import { CampaignWebAuthnError, canUseCampaignBiometrics } from '@/lib/campaignWebAuthnSupport'
import {
  dismissCampaignBiometricsPrompt,
  forgetCampaignBiometricsEnrollment,
  markCampaignBiometricsEnrolledHere,
  wasCampaignBiometricsEnrolledHere,
  wasCampaignBiometricsPromptDismissed,
} from '@/utilities/campaignBiometricsPrompt'

const TOAST_ID = 'campaign-biometric-enrollment'

export type BiometricEnrollmentOffer = {
  /** Whether the ACCOUNT has any passkey — never whether THIS device does. */
  hasEnrolledPasskeys: boolean
  /** Default label for the credential, so accepting the offer needs no typing. */
  suggestedDeviceLabel: string
}

/**
 * Discovery for biometric login, modeled on `InstallPwaToast`: nobody opens the
 * profile looking for a feature they have never heard of. It is an offer, so it
 * is dismissible forever (per device, in `localStorage`) and the permanent home
 * stays the profile card. Mounted only where a ceremony is possible at all — the
 * layout does not render it when the origin has no relying party.
 */
export const BiometricEnrollmentToast = ({
  hasEnrolledPasskeys,
  suggestedDeviceLabel,
}: BiometricEnrollmentOffer) => {
  const router = useRouter()

  useEffect(() => {
    // An account with no passkeys at all is the signal that this browser's
    // "enrolled here" flag is stale — otherwise a person who lost every passkey
    // would never be offered enrollment again on the phone they still hold.
    if (!hasEnrolledPasskeys) forgetCampaignBiometricsEnrollment()

    if (wasCampaignBiometricsEnrolledHere() || wasCampaignBiometricsPromptDismissed()) return

    let cancelled = false

    const offer = async () => {
      try {
        // Loaded on demand: `@simplewebauthn/browser` has no business in the
        // First Load JS of every authenticated route this toast mounts on.
        const { enrollCampaignPasskey } = await import('@/lib/campaignWebAuthnClient')
        await enrollCampaignPasskey(suggestedDeviceLabel)
        markCampaignBiometricsEnrolledHere()
        toast.dismiss(TOAST_ID)
        toast.success('Pronto. Na próxima vez, entre com a biometria.')
        // The profile card lists devices from the server, so it has to re-read.
        router.refresh()
      } catch (error) {
        // A cancelled prompt leaves the toast up: the person may have fumbled
        // the sheet, and this is not the moment to decide for them that they
        // are not interested.
        if (error instanceof CampaignWebAuthnError && error.cancelled) return
        toast.dismiss(TOAST_ID)
        toast.error(
          error instanceof CampaignWebAuthnError
            ? error.message
            : 'Não foi possível cadastrar este aparelho agora.',
        )
      }
    }

    // Same beat as the install toast: let the first paint land before asking
    // for anything.
    const timer = window.setTimeout(() => {
      void canUseCampaignBiometrics().then((supported) => {
        if (!supported || cancelled) return

        toast.message(CAMPAIGN_BIOMETRIC_TOAST_TITLE, {
          id: TOAST_ID,
          description: CAMPAIGN_BIOMETRIC_TOAST_DESCRIPTION,
          duration: Infinity,
          closeButton: true,
          onDismiss: dismissCampaignBiometricsPrompt,
          action: {
            label: CAMPAIGN_BIOMETRIC_ENROLL_LABEL,
            onClick: (event) => {
              // Sonner closes the toast on action unless the click is
              // defaulted-out (verified in 2.0.7). Keeping it open is what lets
              // a cancelled OS prompt land back on a visible offer instead of
              // vanishing with no explanation.
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
  }, [hasEnrolledPasskeys, router, suggestedDeviceLabel])

  return null
}
