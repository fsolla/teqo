'use client'

import { useState, useTransition } from 'react'

import {
  subscribeCampaignPush,
  unsubscribeCampaignPush,
} from '@/app/(campaign)/campanha/actions/notifications'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { CAMPAIGN_PWA_SW_PATH } from '@/utilities/campaignPwa'

type CampaignPushNotificationsCardProps = {
  pushConsentConfigured: boolean
  vapidPublicKey: string | null
}

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

const isIosSafari = (): boolean => {
  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIos && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

const isStandaloneDisplay = (): boolean => {
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return standaloneMedia || iosStandalone
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
    startTransition(async () => {
      setMessage(null)
      setError(null)

      if (!pushConsentConfigured) {
        setError('Consentimento de push ainda não configurado no admin.')
        return
      }
      if (!vapidPublicKey) {
        setError('Push ainda não está disponível neste ambiente.')
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
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Este navegador não suporta notificações push.')
        return
      }

      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setError('Permissão de notificação negada.')
          return
        }

        const registration = await navigator.serviceWorker.register(CAMPAIGN_PWA_SW_PATH, {
          scope: '/campanha',
        })
        await navigator.serviceWorker.ready

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        })
        const json = subscription.toJSON()
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setError('Não foi possível registrar este dispositivo para push.')
          return
        }

        const result = await subscribeCampaignPush({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          expirationTime: subscription.expirationTime,
          consentAccepted: true,
        })

        if ('status' in result && result.status === 'success') {
          setMessage(result.message)
        } else if ('message' in result && result.message) {
          setError(result.message)
        } else {
          setError('Não foi possível ativar os avisos push.')
        }
      } catch {
        setError('Não foi possível ativar os avisos push neste dispositivo.')
      }
    })
  }

  const handleDisable = () => {
    startTransition(async () => {
      setMessage(null)
      setError(null)
      try {
        const registration = await navigator.serviceWorker.getRegistration(CAMPAIGN_PWA_SW_PATH)
        const subscription = await registration?.pushManager.getSubscription()
        if (!subscription) {
          setMessage('Nenhuma inscrição push ativa neste dispositivo.')
          return
        }
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        const result = await unsubscribeCampaignPush(endpoint)
        if ('status' in result && result.status === 'success') {
          setMessage(result.message)
        } else if ('message' in result && result.message) {
          setError(result.message)
        } else {
          setError('Não foi possível desativar os avisos push.')
        }
      } catch {
        setError('Não foi possível desativar os avisos push.')
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
