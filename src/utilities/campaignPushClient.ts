/**
 * Browser-side push ceremony for /campanha, shared by the profile card and the
 * opt-in toast (D6). The activation contract on every caller: the user gesture
 * MUST call `Notification.requestPermission()` synchronously inside the click
 * handler — browsers auto-deny a permission request that arrives outside the
 * gesture (a `startTransition(async …)` boundary is enough to lose it), which
 * surfaces as an instant "Permissão de notificação negada" with no prompt.
 */

import {
  subscribeCampaignPush,
  unsubscribeCampaignPush,
} from '@/app/(campaign)/campanha/actions/notifications'
import {
  CAMPAIGN_PUSH_ACTIVATED_MESSAGE,
  CAMPAIGN_PUSH_CONSENT_UNCONFIGURED_MESSAGE,
  CAMPAIGN_PUSH_ENV_MISSING_MESSAGE,
  CAMPAIGN_PUSH_PERMISSION_DENIED_MESSAGE,
  CAMPAIGN_PUSH_PERMISSION_NOT_SHOWN_MESSAGE,
  CAMPAIGN_PUSH_UNSUPPORTED_MESSAGE,
} from '@/lib/campaignNotificationCopy'
import { CAMPAIGN_PUSH_OPT_IN_DISMISSED_KEY, CAMPAIGN_PWA_SW_PATH } from '@/utilities/campaignPwa'

export type CampaignPushResult =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

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

export const isIosSafari = (): boolean => {
  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIos && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

export const isStandaloneDisplay = (): boolean => {
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return standaloneMedia || iosStandalone
}

export const supportsCampaignPush = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

type ActivateCampaignPushInput = {
  pushConsentConfigured: boolean
  vapidPublicKey: string | null
  /** Result of `Notification.requestPermission()` called synchronously in the gesture. */
  permission: NotificationPermission
}

export const activateCampaignPushOnDevice = async ({
  pushConsentConfigured,
  vapidPublicKey,
  permission,
}: ActivateCampaignPushInput): Promise<CampaignPushResult> => {
  if (!pushConsentConfigured) {
    return { status: 'error', message: CAMPAIGN_PUSH_CONSENT_UNCONFIGURED_MESSAGE }
  }
  if (!vapidPublicKey) {
    return { status: 'error', message: CAMPAIGN_PUSH_ENV_MISSING_MESSAGE }
  }
  if (permission !== 'granted') {
    return {
      status: 'error',
      message:
        permission === 'denied'
          ? CAMPAIGN_PUSH_PERMISSION_DENIED_MESSAGE
          : CAMPAIGN_PUSH_PERMISSION_NOT_SHOWN_MESSAGE,
    }
  }
  if (!supportsCampaignPush()) {
    return { status: 'error', message: CAMPAIGN_PUSH_UNSUPPORTED_MESSAGE }
  }

  try {
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
      return { status: 'error', message: 'Não foi possível registrar este dispositivo para push.' }
    }

    const result = await subscribeCampaignPush({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      expirationTime: subscription.expirationTime,
      consentAccepted: true,
    })

    if ('status' in result && result.status === 'success') {
      return { status: 'success', message: CAMPAIGN_PUSH_ACTIVATED_MESSAGE }
    }
    if ('message' in result && result.message) {
      return { status: 'error', message: result.message }
    }
    return { status: 'error', message: 'Não foi possível ativar os avisos push.' }
  } catch {
    return { status: 'error', message: 'Não foi possível ativar os avisos push neste dispositivo.' }
  }
}

export const deactivateCampaignPushOnDevice = async (): Promise<CampaignPushResult> => {
  try {
    const registration = await navigator.serviceWorker.getRegistration(CAMPAIGN_PWA_SW_PATH)
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      return { status: 'success', message: 'Nenhuma inscrição push ativa neste dispositivo.' }
    }
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    const result = await unsubscribeCampaignPush(endpoint)
    if ('status' in result && result.status === 'success') {
      return { status: 'success', message: result.message }
    }
    if ('message' in result && result.message) {
      return { status: 'error', message: result.message }
    }
    return { status: 'error', message: 'Não foi possível desativar os avisos push.' }
  } catch {
    return { status: 'error', message: 'Não foi possível desativar os avisos push.' }
  }
}

export const readCampaignPushSubscription = async (): Promise<PushSubscription | null> => {
  try {
    const registration = await navigator.serviceWorker.getRegistration(CAMPAIGN_PWA_SW_PATH)
    return (await registration?.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

export const wasCampaignPushOptInDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(CAMPAIGN_PUSH_OPT_IN_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export const dismissCampaignPushOptIn = (): void => {
  try {
    window.localStorage.setItem(CAMPAIGN_PUSH_OPT_IN_DISMISSED_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures: the offer reappearing is a far
    // smaller problem than a thrown error inside a toast callback.
  }
}
