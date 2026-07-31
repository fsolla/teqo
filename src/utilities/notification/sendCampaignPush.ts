import 'server-only'

/** Push delivery uses admin bypass (`overrideAccess: true`) on trusted server paths. */

import webpush from 'web-push'

import type { NotificationPayload } from '@/lib/notificationContract'
import type { Payload } from 'payload'

const resolveVapidConfig = (): {
  publicKey: string
  privateKey: string
  subject: string
} | null => {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:campanha@jorgesolla.com.br'

  if (!publicKey || !privateKey) return null

  return { publicKey, privateKey, subject }
}

let vapidConfigured = false

const ensureVapidConfigured = (): boolean => {
  const vapid = resolveVapidConfig()
  if (!vapid) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
    vapidConfigured = true
  }
  return true
}

export const getCampaignVapidPublicKey = (): string | null =>
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || null

export const sendCampaignPushForNotification = async (
  payload: Payload,
  notificationID: number,
): Promise<void> => {
  if (!ensureVapidConfigured()) return

  const notification = await payload.findByID({
    collection: 'notification',
    id: notificationID,
    depth: 0,
    overrideAccess: true,
  })

  const recipientID =
    typeof notification.recipient === 'number' ? notification.recipient : notification.recipient?.id
  if (!recipientID) return

  const content = notification.payload as NotificationPayload
  if (!content?.title || !content.href) return

  const subscriptions = await payload.find({
    collection: 'pushSubscription',
    where: { user: { equals: recipientID } },
    depth: 0,
    limit: 20,
    pagination: false,
    overrideAccess: true,
  })

  if (subscriptions.docs.length === 0) return

  const pushPayload = JSON.stringify({
    title: content.title,
    body: content.detail,
    url: content.href,
  })

  await Promise.all(
    subscriptions.docs.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
            expirationTime: subscription.expirationTime ?? undefined,
          },
          pushPayload,
          {
            TTL: 60 * 60 * 24,
          },
        )
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode: unknown }).statusCode)
            : null
        if (statusCode === 404 || statusCode === 410) {
          await payload.delete({
            collection: 'pushSubscription',
            id: subscription.id,
            overrideAccess: true,
          })
        }
      }
    }),
  )
}
