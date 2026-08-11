import type { Access, FieldAccess } from 'payload'

import {
  getFreshCampaignUser,
  isCampaignStaff,
  isPayloadAdmin,
  payloadAdminOnly,
} from '@/utilities/access/shared'

/**
 * C114 — access for the `googleCalendarSync` configuration/state collection.
 * Staff (coordinator/advisor/candidate) read the sync state (pill) and toggle
 * `disabledAt`; only Payload admin sets the operational `calendarId`; the
 * system state fields are written solely by the sync engine through an
 * admin bypass — never by a user path.
 */

export const canReadGoogleCalendarSync: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canCreateGoogleCalendarSync: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canUpdateGoogleCalendarSync: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canDeleteGoogleCalendarSync: Access = payloadAdminOnly

/** `calendarId` — operational identity, admin-only (env-level trust). */
export const canSetGoogleCalendarSyncConfigField: FieldAccess = ({ req }) =>
  isPayloadAdmin(req.user)

/** `disabledAt` — staff may pause/resume the sync from the agenda. */
export const canSetGoogleCalendarSyncDisabled: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignStaff(await getFreshCampaignUser(req))
}

/** System state fields — only the sync engine writes them (overrideAccess). */
export const canSetGoogleCalendarSyncSystemField: FieldAccess = () => false
