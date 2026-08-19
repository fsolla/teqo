// ---------------------------------------------------------------------------
// State deputies (dobradinhas)
// ---------------------------------------------------------------------------

import type { Access } from 'payload'

import {
  advisorEditingAccess,
  getFreshCampaignUser,
  isCampaignStaff,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  // C141 — dobradinhas are already staff-wide today; the Edição axis only
  // narrows: a `somente_leitura` advisor creates nothing.
  if (currentUser.role === 'advisor') return advisorEditingAccess(currentUser) !== 'none'

  return true
}

export const canReadStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canManageStateDeputy: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser || !isCampaignStaff(currentUser)) return false
  // C141 — same axis as create.
  if (currentUser.role === 'advisor') return advisorEditingAccess(currentUser) !== 'none'

  return true
}

export const canDeleteStateDeputy: Access = ({ req }) => isPayloadAdmin(req.user)
