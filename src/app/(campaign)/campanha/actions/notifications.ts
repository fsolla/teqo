'use server'

/** Server actions verify ownership then write with admin bypass (`overrideAccess: true`). */

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import {
  CAMPAIGN_NOTIFICATION_LOAD_ERROR_MESSAGE,
  CAMPAIGN_NOTIFICATION_THROW_SAFE_MESSAGES,
  CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE,
  CAMPAIGN_PUSH_SUBSCRIBE_ERROR_MESSAGE,
  CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE,
  CAMPAIGN_PUSH_UNSUBSCRIBE_ERROR_MESSAGE,
} from '@/lib/campaignNotificationCopy'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { requireCampaignPushConsent } from '@/utilities/campaignConsent'
import {
  CAMPAIGN_AUTH_REQUIRED_MESSAGE,
  runCampaignFormAction,
} from '@/utilities/campaignFormActionError'
import {
  countUnreadNotifications,
  loadNotificationList,
  markAllNotificationsRead,
} from '@/utilities/notification/notificationList'
import { getCampaignVapidPublicKey } from '@/utilities/notification/sendCampaignPush'

const CAMPAIGN_NOTIFICATION_SAFE_MESSAGES = [
  CAMPAIGN_AUTH_REQUIRED_MESSAGE,
  ...CAMPAIGN_NOTIFICATION_THROW_SAFE_MESSAGES,
] as const

export type NotificationBellData = {
  unreadCount: number
  vapidPublicKey: string | null
}

export const loadNotificationBellData = async (): Promise<NotificationBellData | null> => {
  const user = await getCampaignUser()
  if (!user) return null

  const payload = await getPayload({ config })
  const unreadCount = await countUnreadNotifications(payload, user)

  return {
    unreadCount,
    vapidPublicKey: getCampaignVapidPublicKey(),
  }
}

/**
 * The bell's open action (C108): loads the panel list AND marks everything
 * unread as read in one round trip — opening the panel is the read gesture,
 * so the badge zeroes without a separate click. List and mark run
 * concurrently; the panel no longer reads per-item `readAt`, so the race is
 * invisible to the UI (the badge is driven by `markedCount`, not the list).
 */
export const openCampaignNotifications = async () =>
  runCampaignFormAction({
    execute: async () => {
      const user = await getCampaignUser()
      if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

      const payload = await getPayload({ config })
      const [items, markedCount] = await Promise.all([
        loadNotificationList(payload, user),
        markAllNotificationsRead(payload, user),
      ])

      if (markedCount > 0) {
        revalidatePath('/campanha', 'layout')
      }

      return { items, markedCount, message: 'Notificações atualizadas.' }
    },
    safeMessages: [CAMPAIGN_AUTH_REQUIRED_MESSAGE],
    genericMessage: CAMPAIGN_NOTIFICATION_LOAD_ERROR_MESSAGE,
  })

type PushSubscribeInput = {
  endpoint: string
  p256dh: string
  auth: string
  expirationTime?: number | null
  consentAccepted: boolean
}

export const subscribeCampaignPush = async (input: PushSubscribeInput) =>
  runCampaignFormAction({
    execute: async () => {
      const user = await getCampaignUser()
      if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)
      if (!input.consentAccepted) {
        throw new Error(CAMPAIGN_PUSH_CONSENT_REQUIRED_MESSAGE)
      }

      const payload = await getPayload({ config })
      const consent = await requireCampaignPushConsent(payload)
      const requestHeaders = await headers()

      const endpoint = input.endpoint.trim()
      const p256dh = input.p256dh.trim()
      const auth = input.auth.trim()
      if (!endpoint || !p256dh || !auth) {
        throw new Error(CAMPAIGN_PUSH_SUBSCRIPTION_INVALID_MESSAGE)
      }

      // Idempotent (D6): `endpoint` is unique and the browser returns the same
      // subscription on re-subscribe — a second create would show a false failure.
      const existing = await payload.find({
        collection: 'pushSubscription',
        where: { endpoint: { equals: endpoint } },
        depth: 0,
        limit: 1,
        pagination: false,
        user,
        overrideAccess: false,
      })

      if (existing.docs.length > 0) {
        return { message: 'Avisos push já estavam ativados neste dispositivo.' }
      }

      await payload.create({
        collection: 'pushSubscription',
        data: {
          user: user.id,
          endpoint,
          p256dh,
          auth,
          expirationTime: input.expirationTime ?? undefined,
          consent: consent.id,
          consentContentHash: consent.contentHash,
          consentedAt: new Date().toISOString(),
          userAgent: requestHeaders.get('user-agent') ?? undefined,
        },
        depth: 0,
        overrideAccess: true,
      })

      return { message: 'Avisos push ativados neste dispositivo.' }
    },
    safeMessages: CAMPAIGN_NOTIFICATION_SAFE_MESSAGES,
    genericMessage: CAMPAIGN_PUSH_SUBSCRIBE_ERROR_MESSAGE,
  })

export const unsubscribeCampaignPush = async (endpoint: string) =>
  runCampaignFormAction({
    execute: async () => {
      const user = await getCampaignUser()
      if (!user) throw new Error(CAMPAIGN_AUTH_REQUIRED_MESSAGE)

      const payload = await getPayload({ config })
      const existing = await payload.find({
        collection: 'pushSubscription',
        where: {
          and: [{ user: { equals: user.id } }, { endpoint: { equals: endpoint } }],
        },
        depth: 0,
        limit: 1,
        pagination: false,
        user,
        overrideAccess: false,
      })

      const subscription = existing.docs[0]
      if (subscription) {
        await payload.delete({
          collection: 'pushSubscription',
          id: subscription.id,
          overrideAccess: true,
        })
      }

      return { message: 'Avisos push desativados neste dispositivo.' }
    },
    safeMessages: CAMPAIGN_NOTIFICATION_SAFE_MESSAGES,
    genericMessage: CAMPAIGN_PUSH_UNSUBSCRIBE_ERROR_MESSAGE,
  })
