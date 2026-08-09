// ---------------------------------------------------------------------------
// State deputies (dobradinhas)
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import { getFreshCampaignUser, isCampaignStaff, isPayloadAdmin } from '@/utilities/access/shared'

export const canCreateStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canReadStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canManageStateDeputy: Access = canReadStateDeputy

export const canDeleteStateDeputy: Access = ({ req }) => isPayloadAdmin(req.user)
