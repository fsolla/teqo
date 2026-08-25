import 'server-only'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'
import type { PayloadRequest } from 'payload'

import {
  GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS,
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
 * C114-LOCK: the hooks run INSIDE the save's transaction, so the Google I/O
 * is bounded by `GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS` (S11 parity) — the row
 * lock (`activity` / `googleCalendarSync`) is not held for the full
 * `REQUEST_TIMEOUT_MS × N` RTTs. The manual / webhook paths keep the full
 * per-hop budget (no transaction open) as the reliable fallback.
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
    // C115 — the reverse direction's own write must not re-enter the engine:
    // the pass that applied the Google edit is still running; a nested pass
    // would only re-list and converge (content equality) at double cost.
    if (req.context?.mutationKind === 'googleCalendarSync') return doc
    const resolvedOperation = operation ?? 'delete'
    if (shouldSyncActivityOperation({ operation: resolvedOperation, doc, previousDoc })) {
      await runCampaignCalendarSync(req.payload, {
        reason: resolvedOperation,
        req,
        signal: AbortSignal.timeout(GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS),
      })
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
      await runCampaignCalendarSync(req.payload, {
        reason: 'config-change',
        req,
        signal: AbortSignal.timeout(GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS),
      })
    }
  } catch {
    // never throw into admin writes
  }
  return doc
}
