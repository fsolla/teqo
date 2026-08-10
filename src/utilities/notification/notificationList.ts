import 'server-only'

import type { Payload } from 'payload'

import type {
  NotificationListItem,
  NotificationPayload,
  NotificationType,
} from '@/lib/notificationContract'
import type { CampaignUser, Notification } from '@/payload-types'

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

const UNREAD_MARK_BATCH_LIMIT = 200

/**
 * Marks the actor's unread notifications as read and returns how many were
 * touched. Batched at `UNREAD_MARK_BATCH_LIMIT` rows — an inbox beyond that
 * keeps unread leftovers that re-pop the badge on the next server render
 * (pathological; the same cap the panel button used before C108). Writes go
 * through the admin bypass on purpose, the same way the panel actions do:
 * `notification.update` access is staff/admin-only (`canWriteNotifications`),
 * and the caller (a server action) has already verified the actor from the
 * session — this helper only ever targets `recipient: user.id`, so no other
 * inbox can be touched through it. Idempotent: a second pass marks nothing.
 */
export const markAllNotificationsRead = async (
  payload: Payload,
  user: CampaignUser,
): Promise<number> => {
  const unread = await payload.find({
    collection: 'notification',
    where: {
      and: [{ recipient: { equals: user.id } }, { readAt: { exists: false } }],
    },
    depth: 0,
    limit: UNREAD_MARK_BATCH_LIMIT,
    pagination: false,
    overrideAccess: true,
  })

  if (unread.docs.length === 0) return 0

  const readAt = new Date().toISOString()
  await Promise.all(
    unread.docs.map((doc) =>
      payload.update({
        collection: 'notification',
        id: doc.id,
        data: { readAt },
        depth: 0,
        overrideAccess: true,
      }),
    ),
  )

  return unread.docs.length
}
