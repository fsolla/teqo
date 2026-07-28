'use client'

import { FingerprintIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { removeCampaignPasskeyAction } from '@/app/(campaign)/campanha/actions/webauthn'
import { useCampaignBiometricsAvailable } from '@/components/campaign/auth/useCampaignBiometricsAvailable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_ENROLL_LABEL,
  CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE,
  CAMPAIGN_BIOMETRIC_PRIVACY_NOTE,
  CAMPAIGN_BIOMETRIC_REMOVE_ERROR_MESSAGE,
  CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE,
  CAMPAIGN_BIOMETRIC_SECTION_DESCRIPTION,
  CAMPAIGN_BIOMETRIC_SECTION_TITLE,
} from '@/lib/campaignAuthCopy'
import {
  CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH,
  CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS,
  type CampaignPasskeyView,
} from '@/lib/campaignWebAuthn'
import { CampaignWebAuthnError } from '@/lib/campaignWebAuthnSupport'
import { markCampaignBiometricsEnrolledHere } from '@/utilities/campaignBiometricsPrompt'

type CampaignPasskeysCardProps = {
  passkeys: CampaignPasskeyView[]
  /** False when this origin cannot host a ceremony (Vercel previews). */
  biometricsConfigured: boolean
  /** Suggested label, so the common case is one tap and no typing. */
  suggestedDeviceLabel: string
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const formatUse = (passkey: CampaignPasskeyView): string =>
  passkey.lastUsedAt
    ? `Último uso em ${dateFormatter.format(new Date(passkey.lastUsedAt))}`
    : `Cadastrado em ${dateFormatter.format(new Date(passkey.createdAt))} · ainda não usado`

/**
 * The permanent home of biometric access (B40). It is the card, not the toast,
 * that has to work: the toast is discoverability and can be dismissed forever,
 * while revocation — the answer to "meu celular sumiu" — must always be
 * findable in the profile.
 */
export const CampaignPasskeysCard = ({
  passkeys,
  biometricsConfigured,
  suggestedDeviceLabel,
}: CampaignPasskeysCardProps) => {
  // Optimistic list. Enrollment goes through a route handler, which revalidates
  // nothing, so this is the only thing that renders the new row until the next
  // navigation; removal is a server action and does revalidate, and the effect
  // below is what lets the server's answer win.
  const [items, setItems] = useState(passkeys)
  const [deviceLabel, setDeviceLabel] = useState(suggestedDeviceLabel)
  const [enrolling, setEnrolling] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()
  const platformAvailable = useCampaignBiometricsAvailable()

  useEffect(() => setItems(passkeys), [passkeys])

  const canEnroll = biometricsConfigured && platformAvailable
  const atLimit = items.length >= CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS

  const enroll = async () => {
    const label = deviceLabel.trim()
    if (!label || enrolling) return

    setEnrolling(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      // Loaded on demand: this card renders for everyone who opens the profile,
      // but only a tap here needs `@simplewebauthn/browser`.
      const { enrollCampaignPasskey } = await import('@/lib/campaignWebAuthnClient')
      const passkey = await enrollCampaignPasskey(label)
      setItems((current) => [passkey, ...current])
      setStatusMessage(CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE)
      // Only this browser can know that THIS device is enrolled — the server
      // only ever sees a credential count — so the prompt is silenced here.
      markCampaignBiometricsEnrolledHere()
    } catch (error) {
      setErrorMessage(
        error instanceof CampaignWebAuthnError
          ? error.message
          : CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE,
      )
    } finally {
      setEnrolling(false)
    }
  }

  const remove = (passkey: CampaignPasskeyView) => {
    setRemovingId(passkey.id)
    setErrorMessage(null)
    setStatusMessage(null)

    startTransition(async () => {
      const result = await removeCampaignPasskeyAction({ passkeyId: passkey.id })
      setRemovingId(null)

      if (result.status === 'success') {
        setItems((current) => current.filter((entry) => entry.id !== passkey.id))
        setStatusMessage(CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE)
        // Toast as well as the live region: removing the device you are holding
        // is the one action here whose confirmation must survive a navigation.
        toast.success(CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE)
        return
      }

      // A rejected id maps to `fieldErrors` with no message, and this card has
      // no field to hang it on.
      setErrorMessage(result.message ?? CAMPAIGN_BIOMETRIC_REMOVE_ERROR_MESSAGE)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{CAMPAIGN_BIOMETRIC_SECTION_TITLE}</CardTitle>
        <CardDescription>{CAMPAIGN_BIOMETRIC_SECTION_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {items.map((passkey) => (
              <li
                key={passkey.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FingerprintIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{passkey.deviceLabel}</p>
                    <p className="text-xs text-muted-foreground">{formatUse(passkey)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  disabled={removingId === passkey.id}
                  aria-label={`Remover ${passkey.deviceLabel}`}
                  onClick={() => remove(passkey)}
                >
                  {removingId === passkey.id ? (
                    <Spinner className="size-4" aria-hidden="true" />
                  ) : (
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum aparelho cadastrado ainda.</p>
        )}

        {/* The enrollment form is absent — not disabled — when the platform
            cannot do it: there is nothing the person could change here to make
            a desktop without a reader work, and the list above is still the
            useful half (they may revoke a phone from this very screen). */}
        {canEnroll && !atLimit ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Field>
              <FieldLabel htmlFor="passkey-device-label">Nome deste aparelho</FieldLabel>
              <Input
                id="passkey-device-label"
                value={deviceLabel}
                onChange={(event) => setDeviceLabel(event.target.value)}
                maxLength={CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH}
                className="min-h-11"
                placeholder="Meu celular"
              />
              <FieldDescription>
                Serve para você reconhecer o aparelho nesta lista e removê-lo se perdê-lo.
              </FieldDescription>
            </Field>
            <Button
              type="button"
              className="min-h-11 self-start"
              disabled={enrolling || deviceLabel.trim().length === 0}
              onClick={() => void enroll()}
            >
              {enrolling ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <FingerprintIcon data-icon="inline-start" aria-hidden="true" />
              )}
              <span>{enrolling ? 'Confirmando...' : CAMPAIGN_BIOMETRIC_ENROLL_LABEL}</span>
            </Button>
          </div>
        ) : null}

        {atLimit ? (
          <p className="text-sm text-muted-foreground">
            Você já cadastrou {CAMPAIGN_WEBAUTHN_MAX_CREDENTIALS} aparelhos. Remova um para
            cadastrar outro.
          </p>
        ) : null}

        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}

        <p className="text-xs text-muted-foreground">{CAMPAIGN_BIOMETRIC_PRIVACY_NOTE}</p>

        {/* Success only: `FieldError` above is a `role="alert"`, so putting the
            failure here too would announce it twice. Cleared on the next
            attempt, so it never reads a stale success. */}
        <p className="sr-only" aria-live="polite">
          {enrolling ? 'Confirmando a biometria.' : (statusMessage ?? '')}
        </p>
      </CardContent>
    </Card>
  )
}
