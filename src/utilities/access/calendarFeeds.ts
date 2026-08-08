import type { Access, FieldAccess } from 'payload'

import {
  getFreshCampaignUser,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateCalendarFeed: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return isCampaignStaff(currentUser)
}

export const canReadCalendarFeed: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  return { createdBy: { equals: currentUser.id } }
}

export const canUpdateCalendarFeed: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  return { createdBy: { equals: currentUser.id } }
}

export const canDeleteCalendarFeed: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || currentUser.role !== 'advisor') return false

  return { createdBy: { equals: currentUser.id } }
}

export const canSetCalendarFeedSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
