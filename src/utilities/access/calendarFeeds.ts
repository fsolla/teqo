import type { Access, FieldAccess } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import {
  getFreshCampaignUser,
  isCampaignStaff,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

export const canCreateCalendarFeed: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser || !isCampaignStaff(currentUser)) return false

  // The remaining staff role is advisor. A pinned filter municipality must be one
  // the advisor administers (same shape as `canCreateSupporter`); the same scope
  // is re-derived on every read, so an unfiltered feed stays within scope too.
  const municipalityID = relationshipId(data?.filterMunicipality)
  if (!municipalityID) return true

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  return municipalityIDs?.includes(municipalityID) ?? false
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

/**
 * Staff may mint a feed's secret on create; only Payload admin rotates it.
 * The read side is kept `() => false` in the collection, so the credential is
 * never re-read; `update` stays admin-only (revoke+recreate, never in place).
 */
export const canSetCalendarFeedSecret: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}

/**
 * Staff may mark a feed revoked (update only). `canUpdateCalendarFeed` already
 * scopes advisors to their own feeds, so a staff member can only revoke a feed
 * they created.
 */
export const canSetCalendarFeedRevocation: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignStaff(await getFreshCampaignUser(req))
}
