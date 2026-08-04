// ---------------------------------------------------------------------------
// State deputies (dobradinhas)
// ---------------------------------------------------------------------------

import type { Access, FieldAccess } from 'payload'

import {
  getFreshCampaignUser,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

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

/**
 * Advisor assignment on a dobradinha is unrestricted staff (coordinator +
 * candidate) — the same policy as `Municipality.advisors` (B156). The write
 * path runs through the server action with `overrideAccess` after
 * `reloadUnrestrictedActor`; this guards direct `/admin` edits.
 */
export const canAssignStateDeputyAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

export const canManageStateDeputyAdvisors: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
