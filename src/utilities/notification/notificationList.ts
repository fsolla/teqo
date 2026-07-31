import 'server-only'

/** Trusted server reads in this module use admin bypass (`overrideAccess: true`). */

import type {
  NotificationListItem,
  NotificationPayload,
  NotificationType,
} from '@/lib/notificationContract'
import type { Notification } from '@/payload-types'

export type { NotificationListItem } from '@/lib/notificationContract'

const isNotificationPayload = (value: unknown): value is NotificationPayload => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.title === 'string' &&
    typeof record.detail === 'string' &&
    typeof record.href === 'string'
  )
}

const toNotificationListItem = (doc: Notification): NotificationListItem | null => {
  if (!isNotificationPayload(doc.payload)) return null

  return {
    id: doc.id,
    type: doc.type as NotificationType,
    payload: doc.payload,
    readAt: doc.readAt ?? null,
    createdAt: doc.createdAt,
  }
}

export const countUnreadNotifications = async (
  payload: import('payload').Payload,
  recipientID: number,
): Promise<number> => {
  const result = await payload.count({
    collection: 'notification',
    where: {
      and: [{ recipient: { equals: recipientID } }, { readAt: { exists: false } }],
    },
    overrideAccess: true,
  })

  return result.totalDocs
}

export const loadNotificationList = async (
  payload: import('payload').Payload,
  recipientID: number,
  limit = 40,
): Promise<NotificationListItem[]> => {
  const result = await payload.find({
    collection: 'notification',
    where: { recipient: { equals: recipientID } },
    depth: 0,
    limit,
    sort: '-createdAt',
    overrideAccess: true,
  })

  return result.docs
    .map((doc) => toNotificationListItem(doc))
    .filter((item): item is NotificationListItem => item !== null)
}
