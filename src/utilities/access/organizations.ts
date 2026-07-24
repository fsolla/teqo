// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import {
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignStaff,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canReadOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || isCampaignLeader(currentUser)) return false
  if (isCampaignStaff(currentUser)) return true

  return false
}

export const canManageOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canDeleteOrganization: Access = ({ req }) => isPayloadAdmin(req.user)
