// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import {
  advisorEditingAccess,
  getFreshCampaignUser,
  isCampaignLeader,
  isCampaignStaff,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateOrganization: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  // C141 — organizations are already staff-wide today; the Edição axis only
  // narrows: a `somente_leitura` advisor creates nothing.
  if (currentUser.role === 'advisor') return advisorEditingAccess(currentUser) !== 'none'

  return true
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

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  // C141 — same axis as create: `somente_leitura` advisors write nothing.
  if (currentUser.role === 'advisor') return advisorEditingAccess(currentUser) !== 'none'

  return true
}

export const canDeleteOrganization: Access = ({ req }) => isPayloadAdmin(req.user)
