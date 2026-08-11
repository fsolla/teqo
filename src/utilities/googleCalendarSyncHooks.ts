import 'server-only'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'
import type { PayloadRequest } from 'payload'

import {
  runCampaignCalendarSync,
  shouldSyncActivityOperation,
  shouldSyncConfigChange,
} from '@/utilities/googleCalendarSync'

/**
 * C114 — the two Payload hooks that trigger the Google mirror (in a module of
 * their own so tests can mock the engine at the import boundary).
 *
 * Activity hook (afterChange + afterDelete): delegates the decision to the
 * pure guard — task toggles, updates and result records never trigger a pass.
 * afterDelete hooks carry no `operation`; its absence means delete.
 * Config hook (afterChange on `googleCalendarSync`): D7 auto-resync — a
 * changed `calendarId` or a re-enable runs the full reconciliation against
 * the new calendar; state-only writes never re-trigger (no loop).
 *
 * Both NEVER throw: the Teqo write paths are independent of Google
 * (fail-closed at the trigger; engine failures land in the `paused` state).
 */
export const activityGoogleCalendarSyncHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}: {
  doc: Activity
  previousDoc?: Activity
  operation?: 'create' | 'update'
  req: PayloadRequest
}): Promise<unknown> => {
  try {
    const resolvedOperation = operation ?? 'delete'
    if (shouldSyncActivityOperation({ operation: resolvedOperation, doc, previousDoc })) {
      await runCampaignCalendarSync(req.payload, { reason: resolvedOperation, req })
    }
  } catch {
    // recorded as paused inside the engine; the write path stays intact
  }
  return doc
}

export const googleCalendarSyncConfigHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}: {
  doc: GoogleCalendarSyncDoc
  previousDoc?: GoogleCalendarSyncDoc
  operation: 'create' | 'update'
  req: PayloadRequest
}): Promise<unknown> => {
  try {
    if (shouldSyncConfigChange({ operation, doc, previousDoc })) {
      await runCampaignCalendarSync(req.payload, { reason: 'config-change', req })
    }
  } catch {
    // never throw into admin writes
  }
  return doc
}
