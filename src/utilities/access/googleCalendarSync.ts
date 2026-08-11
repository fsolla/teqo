import type { Access, FieldAccess } from 'payload'

import {
  getFreshCampaignUser,
  isCampaignStaff,
  isPayloadAdmin,
  payloadAdminOnly,
} from '@/utilities/access/shared'

/**
 * C114+C115 — access for the `googleCalendarSync` configuration/state
 * collection. Staff (coordinator/advisor/candidate) read the sync state
 * (pill) and toggle `disabledAt`; only Payload admin sets the operational
 * `calendarId` and creates the row (the single-row invariant is enforced at
 * the read: the configured row wins); the system state fields are written
 * solely by the sync engine through an admin bypass — never by a user path.
 * The push-channel identity fields (id/resource/secret — the webhook
 * credential set) are unreadable to any user path, admin included: the
 * engine and the webhook read them with the admin bypass.
 */

export const canReadGoogleCalendarSync: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignStaff(await getFreshCampaignUser(req))
}

export const canCreateGoogleCalendarSync: Access = payloadAdminOnly

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

/**
 * C115 — the webhook credential set never leaves the engine: field-level
 * `read` denies every user path (the engine/webhook read with the admin
 * bypass). A future server action reading the config row would otherwise
 * hand out full push-forging authority to any staff member.
 */
export const canReadGoogleCalendarSyncIdentityField: FieldAccess = () => false
