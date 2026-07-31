import 'server-only'

import type { Payload } from 'payload'

import type {
  NotificationListItem,
  NotificationPayload,
  NotificationType,
} from '@/lib/notificationContract'
import type { CampaignUser, Notification } from '@/payload-types'

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

// Reads go through collection access (`canReadOwnNotifications` scopes to the
// recipient) with the explicit recipient filter as a second fence: the actor
// is the only thing these loaders accept, so a caller cannot ask for someone
// else's inbox. No admin bypass — that is what the create/update paths are
// for, and they live in the domain hooks/actions with their own justifications.
export const countUnreadNotifications = async (
  payload: Payload,
  user: CampaignUser,
): Promise<number> => {
  const result = await payload.count({
    collection: 'notification',
    where: {
      and: [{ recipient: { equals: user.id } }, { readAt: { exists: false } }],
    },
    user,
    overrideAccess: false,
  })

  return result.totalDocs
}

export const loadNotificationList = async (
  payload: Payload,
  user: CampaignUser,
  limit = 40,
): Promise<NotificationListItem[]> => {
  const result = await payload.find({
    collection: 'notification',
    where: { recipient: { equals: user.id } },
    depth: 0,
    limit,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  return result.docs
    .map((doc) => toNotificationListItem(doc))
    .filter((item): item is NotificationListItem => item !== null)
}
