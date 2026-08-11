'use client'

import { useState, useTransition } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_PUSH_CONSENT_UNCONFIGURED_MESSAGE,
  CAMPAIGN_PUSH_ENV_MISSING_MESSAGE,
  CAMPAIGN_PUSH_UNSUPPORTED_MESSAGE,
} from '@/lib/campaignNotificationCopy'
import {
  activateCampaignPushOnDevice,
  deactivateCampaignPushOnDevice,
  isIosSafari,
  isStandaloneDisplay,
  supportsCampaignPush,
} from '@/utilities/campaignPushClient'

type CampaignPushNotificationsCardProps = {
  pushConsentConfigured: boolean
  vapidPublicKey: string | null
}

export const CampaignPushNotificationsCard = ({
  pushConsentConfigured,
  vapidPublicKey,
}: CampaignPushNotificationsCardProps) => {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleEnable = () => {
    setMessage(null)
    setError(null)

    // Synchronous guards first, then `requestPermission` INSIDE the click
    // gesture: a permission request arriving outside the gesture (e.g. after a
    // `startTransition` async boundary) is auto-denied by Chrome without ever
    // showing the native prompt — the "Permissão de notificação negada" no-op.
    if (!pushConsentConfigured) {
      setError(CAMPAIGN_PUSH_CONSENT_UNCONFIGURED_MESSAGE)
      return
    }
    if (!vapidPublicKey) {
      setError(CAMPAIGN_PUSH_ENV_MISSING_MESSAGE)
      return
    }
    if (!consentAccepted) {
      setError('Aceite o consentimento para ativar os avisos push.')
      return
    }
    if (isIosSafari() && !isStandaloneDisplay()) {
      setError('No iPhone, instale o app na tela inicial antes de ativar os avisos push.')
      return
    }
    if (!supportsCampaignPush()) {
      setError(CAMPAIGN_PUSH_UNSUPPORTED_MESSAGE)
      return
    }

    const permissionRequest = Notification.requestPermission()

    startTransition(async () => {
      const permission = await permissionRequest
      const result = await activateCampaignPushOnDevice({
        pushConsentConfigured,
        vapidPublicKey,
        permission,
      })

      if (result.status === 'success') {
        setMessage(result.message)
      } else {
        setError(result.message)
      }
    })
  }

  const handleDisable = () => {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await deactivateCampaignPushOnDevice()
      if (result.status === 'success') {
        setMessage(result.message)
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos push</CardTitle>
        <CardDescription>
          Receba alertas da campanha mesmo com o app fechado. No iPhone, só funciona com o app
          instalado na tela inicial.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!pushConsentConfigured ? (
          <Alert variant="destructive">
            <AlertTitle>Consentimento não configurado</AlertTitle>
            <AlertDescription>
              O texto LGPD ainda não foi cadastrado no admin. A ativação de push fica bloqueada até
              a assessoria publicar a chave <code>campanha-notificacoes-push</code>.
            </AlertDescription>
          </Alert>
        ) : (
          <Field orientation="horizontal">
            <Checkbox
              id="push-consent"
              checked={consentAccepted}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                setConsentAccepted(checked === true)
              }
              disabled={isPending}
            />
            <FieldContent>
              <FieldLabel htmlFor="push-consent">Aceito receber avisos push da campanha</FieldLabel>
              <FieldDescription>
                Você pode desativar a qualquer momento nesta tela ou nas configurações do navegador.
              </FieldDescription>
            </FieldContent>
          </Field>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleEnable} disabled={isPending || !vapidPublicKey}>
            {isPending ? <Spinner className="size-4" /> : null}
            Ativar neste dispositivo
          </Button>
          <Button type="button" variant="outline" onClick={handleDisable} disabled={isPending}>
            Desativar neste dispositivo
          </Button>
        </div>

        {message ? (
          <p className="text-sm text-foreground" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
