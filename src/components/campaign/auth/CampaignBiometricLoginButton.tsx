'use client'

import { FingerprintIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCampaignBiometricsAvailable } from '@/components/campaign/auth/useCampaignBiometricsAvailable'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_BIOMETRIC_LOGIN_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_LOGIN_LABEL,
} from '@/lib/campaignAuthCopy'
import { CampaignWebAuthnError } from '@/lib/campaignWebAuthnSupport'

/**
 * Password-less sign-in on the login screen. It is mounted only when the server
 * says the relying party is configured for this origin (Vercel previews are
 * not) **and** the browser confirms a user-verifying platform authenticator
 * exists — a button that can only fail is worse than no button, and this screen
 * is the one place where a dead control reads as "the app is broken".
 */
export const CampaignBiometricLoginButton = () => {
  const router = useRouter()
  const available = useCampaignBiometricsAvailable()
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!available) return null

  const signIn = async () => {
    setPending(true)
    setErrorMessage(null)

    try {
      // Loaded on demand so `@simplewebauthn/browser` stays out of the login
      // screen's First Load JS — nothing here runs before this tap.
      const { signInWithCampaignPasskey } = await import('@/lib/campaignWebAuthnClient')
      const redirectTo = await signInWithCampaignPasskey()
      // The cookie is already set by the route; the refresh is what makes the
      // authenticated layout pick it up. `pending` stays true through the
      // navigation so the button cannot be pressed twice mid-redirect.
      router.replace(redirectTo)
      router.refresh()
      return
    } catch (error) {
      // A cancelled prompt is a decision, not a failure: say it plainly and
      // leave the password form untouched.
      setErrorMessage(
        error instanceof CampaignWebAuthnError
          ? error.message
          : CAMPAIGN_BIOMETRIC_LOGIN_ERROR_MESSAGE,
      )
    }
    setPending(false)
  }

  return (
    // The spacing lives here, not on a wrapper in the form: this island renders
    // nothing when the device has no authenticator, and an empty wrapper would
    // still push the "Primeiro acesso?" line down.
    <div className="mt-6 flex flex-col gap-2">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full"
        disabled={pending}
        onClick={() => void signIn()}
      >
        {pending ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <FingerprintIcon data-icon="inline-start" aria-hidden="true" />
        )}
        <span>{pending ? 'Confirmando...' : CAMPAIGN_BIOMETRIC_LOGIN_LABEL}</span>
      </Button>
      {/* Pending only: the `FieldError` above is a `role="alert"`, so putting the
          message here too made a screen reader say it twice. */}
      <p className="sr-only" aria-live="polite">
        {pending ? 'Confirmando a biometria.' : ''}
      </p>
    </div>
  )
}
