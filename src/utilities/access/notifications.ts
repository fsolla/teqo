import { isCampaignUser, isPayloadAdmin, payloadAdminOnly } from '@/utilities/access/shared'
import type { Access } from 'payload'

/** A notification row belongs to exactly one recipient — never another staff account. */
export const canReadOwnNotifications: Access = ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  if (!isCampaignUser(req.user)) return false

  return { recipient: { equals: req.user.id } }
}

export const canDeleteOwnNotifications: Access = canReadOwnNotifications

/** Created by domain hooks and server actions with admin bypass (`overrideAccess: true`). */
export const canWriteNotifications: Access = payloadAdminOnly

export const canReadOwnPushSubscriptions: Access = ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  if (!isCampaignUser(req.user)) return false

  return { user: { equals: req.user.id } }
}

export const canDeleteOwnPushSubscriptions: Access = canReadOwnPushSubscriptions

/** Subscribe ceremony writes with admin bypass (`overrideAccess: true`) after consent checks. */
export const canWritePushSubscriptions: Access = payloadAdminOnly
