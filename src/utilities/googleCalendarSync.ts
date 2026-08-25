import 'server-only'

import { randomBytes, randomUUID } from 'node:crypto'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'
import type { Payload, PayloadRequest, Where } from 'payload'

import {
  activityMunicipalityIdOf,
  buildGoogleEventPayload,
  decodeGoogleEventActivityId,
  GOOGLE_EVENT_STATUS_CANCELLED,
  googleEventContentEquals,
  googleEventIdForActivity,
  googleStartEndInstantEquals,
  type GoogleRemoteEvent,
} from '@/lib/googleCalendarEventMapping'
import {
  buildGoogleReverseCancelBody,
  buildGoogleReverseUpdateBody,
  googleEditIsNewer,
  googleScheduleToActivityFields,
  googleTitleFromSummary,
  type GoogleReverseActivityEdit,
} from '@/lib/googleCalendarReverseEdit'
import {
  buildActivityWindowRange,
  buildActivityWindowWhereClauses,
  loadMunicipalityNames,
} from '@/utilities/calendarFeed'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import {
  createGoogleCalendarClient,
  GoogleCalendarApiError,
  type GoogleCalendarClient,
  type GoogleCalendarCredentials,
} from '@/utilities/googleCalendarClient'

/**
 * C114+C115 — the campaign↔Google calendar reconciliation engine.
 *
 * One full pass per run (D3): load the staff-scope activities in the window,
 * list the calendar's events in a slightly wider window (incl. cancelled),
 * diff by the deterministic event id (`teqo` + base32hex(activityId)) and
 * reconcile BOTH directions: the Teqo re-asserts its state (create/update/
 * delete — updates only when the content differs, so repeated passes
 * converge without touching Google), and a Google edit that is NEWER by the
 * clock rule is applied back to the activity (title/schedule/cancellation —
 * D2/D3/D4). Canceled and hard-deleted activities drop out of the wanted
 * set, which deletes their Google event: Teqo keeps the SoT, Google keeps no
 * "canceled" state visible to followers.
 *
 * Triggers (D4): activity afterChange/afterDelete (relevant fields only),
 * agenda-page auto-retry and the manual "Sincronizar agora", the
 * `googleCalendarSync` config afterChange (D7: calendarId change / re-enable)
 * and — C115 — the public webhook receiving a push notification. Every
 * trigger also lazily ensures the push channel (D5). The engine NEVER throws
 * into the caller — failures land in the state fields and the status derives
 * to `paused`; the channel itself is best-effort and never pauses the mirror.
 */

export const GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV = 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY'

/**
 * C115 — public push-channel surface. The webhook address embeds the channel
 * secret (same link-as-credential model as the iCal feed); Google echoes the
 * token (the same secret) on every notification, so the route validates URL
 * secret + channel id + resource id + token before acting.
 */
const GOOGLE_CALENDAR_WEBHOOK_PATH = '/campanha/agenda/google-webhook/'
/** Google's internal TTL cap (~30 days per the events/watch docs). */
const PUSH_CHANNEL_TTL_SECONDS = 30 * 24 * 60 * 60
/** Renewal lead — a channel is replaced 48h before it would expire. */
const PUSH_CHANNEL_RENEW_LEAD_MS = 48 * 60 * 60 * 1000

/**
 * The list window scans further into the past than the push window so a
 * canceled/deleted event older than the 90-day lookback is still found and
 * deleted (a realistic case: canceling an activity that happened months ago).
 */
const SYNC_DELETE_LOOKBACK_DAYS = 730
const SYNC_LIST_WINDOW_BUFFER_DAYS = 30
/**
 * Deadline for the hook-triggered sync only (C114-LOCK, mirrors S11-FOLLOWUP):
 * the afterChange/afterDelete hooks run INSIDE the save's transaction, holding
 * the `activity` / `googleCalendarSync` row lock for their whole duration — a
 * full reconciliation pass does N×RTTs to Google (token → list → N writes →
 * watch → stop), each with `REQUEST_TIMEOUT_MS=15s`. Without a hook budget
 * the lock is held for 45–75s, blocking concurrent campaign writes and pinning
 * a Drizzle pool connection on network I/O (the anti-pattern the Issue calls
 * out). The manual / webhook paths have no transaction open and keep the full
 * per-hop 15s budget — they are the reliable fallback when the hook aborts.
 */
export const GOOGLE_CALENDAR_SYNC_HOOK_TIMEOUT_MS = 5_000
/**
 * The fields the Google event mirrors (title, schedule, location, tags,
 * deputy flag, municipality). Task toggles, updates and result records are
 * deliberately absent — those never trigger a pass.
 */
const SYNC_RELEVANT_ACTIVITY_FIELDS = [
  'title',
  'status',
  'startAt',
  'endAt',
  'allDay',
  'locality',
  'municipality',
  'tags',
  'deputyPresent',
] as const

export type GoogleCalendarSyncStatus = 'not-configured' | 'disabled' | 'synced' | 'paused'

export type GoogleCalendarSyncView = {
  status: GoogleCalendarSyncStatus
  calendarId: string | null
  lastSyncedAt: string | null
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  pushChannelExpiresAt: string | null
  pushChannelError: string | null
}

/**
 * Pure derivation (never stored): the pill state is a function of the
 * credential presence, the configured calendar and the last attempt outcomes.
 * `paused` wins while the last attempt failed; any later success recovers.
 */
export const deriveGoogleCalendarSyncStatus = (input: {
  hasCredential: boolean
  calendarId: string | null | undefined
  disabledAt?: string | null | undefined
  lastSuccessAt?: string | null | undefined
  lastErrorAt?: string | null | undefined
}): GoogleCalendarSyncStatus => {
  if (!input.hasCredential || !input.calendarId) return 'not-configured'
  if (input.disabledAt) return 'disabled'
  if (input.lastErrorAt && (!input.lastSuccessAt || input.lastErrorAt > input.lastSuccessAt)) {
    return 'paused'
  }
  return 'synced'
}

/**
 * Reads the service account credential from the environment (base64 of the
 * Google Cloud JSON key). Fail-closed: malformed/absent → null, which
 * disables the sync entirely without breaking anything else.
 */
export const readGoogleServiceAccountCredentials = (): GoogleCalendarCredentials | null => {
  const raw = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
  if (!raw) return null

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >
    if (
      typeof parsed.client_email === 'string' &&
      typeof parsed.private_key === 'string' &&
      parsed.private_key.length > 0
    ) {
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key }
    }
  } catch {
    // malformed credential — treated as absent (fail-closed, no sync attempts)
  }
  return null
}

export const loadGoogleCalendarSyncConfig = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<GoogleCalendarSyncDoc | null> => {
  // Intentional admin bypass: config/state of the mirror is read by the
  // engine and the agenda pill for any staff — access is enforced at the
  // action layer, never per-read. The configured row wins: a stray empty
  // row (staff can no longer create one, but legacy rows may exist) must
  // never shadow the operational calendar (single-row invariant). The
  // webhook route and the engine rely on this bypass for the channel
  // identity fields, which no user path may read.
  const result = await payload.find({
    collection: 'googleCalendarSync',
    limit: 1,
    pagination: false,
    depth: 0,
    where: { calendarId: { exists: true } },
    overrideAccess: true,
    req,
  })
  return result.docs[0] ?? null
}

const docToView = (
  doc: GoogleCalendarSyncDoc | null,
  hasCredential: boolean,
): GoogleCalendarSyncView => ({
  status: deriveGoogleCalendarSyncStatus({
    hasCredential,
    calendarId: doc?.calendarId ?? null,
    disabledAt: doc?.disabledAt ?? null,
    lastSuccessAt: doc?.lastSuccessAt ?? null,
    lastErrorAt: doc?.lastErrorAt ?? null,
  }),
  calendarId: doc?.calendarId ?? null,
  lastSyncedAt: doc?.lastSyncedAt ?? null,
  lastSuccessAt: doc?.lastSuccessAt ?? null,
  lastErrorAt: doc?.lastErrorAt ?? null,
  lastError: doc?.lastError ?? null,
  pushChannelExpiresAt: doc?.pushChannelExpiresAt ?? null,
  pushChannelError: doc?.pushChannelError ?? null,
})

/** The read model the agenda UI renders — status derived, never stored. */
export const readGoogleCalendarSyncView = async (
  payload: Payload,
): Promise<GoogleCalendarSyncView> => {
  const [doc, credentials] = await Promise.all([
    loadGoogleCalendarSyncConfig(payload),
    readGoogleServiceAccountCredentials(),
  ])
  return docToView(doc, credentials !== null)
}

/**
 * The official calendar mirrors the FULL staff scope (espelho cheio): no
 * advisor intersection — a coordinator-managed calendar, unlike per-feed
 * creator scopes. Canceled activities are excluded from the PUSH set (their
 * events get deleted); the window is the feed's own (shared contract).
 * `activityWhere` narrows the mirrored set (e.g. a scoped mirror or test
 * isolation) — production callers omit it and keep the full scope.
 */
const loadSyncActivities = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  activityWhere?: Where,
): Promise<{ activities: Activity[]; municipalityNames: Map<number, string> }> => {
  const { rangeStart, rangeEnd } = buildActivityWindowRange()

  const result = await payload.find({
    collection: 'activity',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'startAt',
    where: {
      and: [
        ...buildActivityWindowWhereClauses(rangeStart, rangeEnd),
        ...(activityWhere ? [activityWhere] : []),
      ],
    },
    // Intentional admin bypass: the official mirror is the whole campaign
    // agenda (espelho cheio) — the collection access already gates writers.
    overrideAccess: true,
    req,
  })

  const activities = result.docs
  const municipalityIds = [
    ...new Set(
      activities
        .map((activity) => activityMunicipalityIdOf(activity.municipality))
        .filter((id): id is number => id !== undefined),
    ),
  ]
  const municipalityNames = await loadMunicipalityNames(payload, municipalityIds)

  return { activities, municipalityNames }
}

/**
 * Ids of activities alive over the WIDER past window — the delete guard set.
 * An event older than the push lookback whose activity is still alive (e.g. a
 * past `realizado` commitment) must NOT be deleted; canceled/hard-deleted
 * activities drop out of this set and their events are cleaned up wherever
 * they are in the extended window.
 */
const loadAliveActivityIds = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  timeMin: string,
  timeMax: string,
  activityWhere?: Where,
): Promise<Set<number>> => {
  const result = await payload.find({
    collection: 'activity',
    depth: 0,
    limit: 0,
    pagination: false,
    where: {
      and: [
        { startAt: { less_than: timeMax } },
        {
          or: [
            { endAt: { greater_than: timeMin } },
            {
              and: [{ endAt: { exists: false } }, { startAt: { greater_than_equal: timeMin } }],
            },
          ],
        },
        { status: { not_equals: 'cancelado' } },
        ...(activityWhere ? [activityWhere] : []),
      ],
    },
    // Intentional admin bypass: same espelho-cheio rationale as above.
    overrideAccess: true,
    req,
  })
  return new Set(result.docs.map((activity) => activity.id))
}

/**
 * The list window scans the extended past so canceled/deleted events older
 * than the 90-day push lookback are still found and removed (canceling an
 * activity that happened months ago is a realistic operation).
 */
const buildListWindow = (
  rangeStart: string,
  rangeEnd: string,
): { timeMin: string; timeMax: string } => {
  const bufferMs = SYNC_LIST_WINDOW_BUFFER_DAYS * 86_400_000
  const deleteLookbackMs = SYNC_DELETE_LOOKBACK_DAYS * 86_400_000
  const nowMs = Date.now()
  return {
    timeMin: new Date(
      Math.min(new Date(rangeStart).getTime() - bufferMs, nowMs - deleteLookbackMs),
    ).toISOString(),
    timeMax: new Date(new Date(rangeEnd).getTime() + bufferMs).toISOString(),
  }
}

const deleteRemoteEvent = async (
  client: GoogleCalendarClient,
  calendarId: string,
  eventId: string,
): Promise<void> => {
  try {
    await client.deleteEvent(calendarId, eventId)
  } catch (error) {
    // Already gone is the desired end state.
    if (!(error instanceof GoogleCalendarApiError && error.status === 404)) throw error
  }
}

type SyncCounts = { created: number; updated: number; deleted: number; reverseEdits: number }

/**
 * C115 — the reconciliation's last-seen snapshot (JSONB on the sync row).
 * `calendarId` pins WHICH calendar the ids were seen on: after a calendar
 * switch the snapshot is stale and treated as empty (fresh mirror), and the
 * push channel is re-created for the new calendar (see the channel ensure).
 * Only written on SUCCESSFUL passes — a failed event creation is never
 * "seen", so the next pass creates instead of cancelling.
 */
type GoogleCalendarSyncSnapshot = { calendarId: string; ids: string[] }

const parseLastSeenSnapshot = (raw: unknown): GoogleCalendarSyncSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as { calendarId?: unknown; ids?: unknown }
  if (typeof candidate.calendarId !== 'string') return null
  if (!Array.isArray(candidate.ids)) return null
  const ids = candidate.ids.filter((id): id is string => typeof id === 'string')
  return { calendarId: candidate.calendarId, ids }
}

/**
 * Appends the audit record ("com registro", D8) to the activity's updates
 * feed and applies the reverse values. System write with an admin bypass —
 * the authorized Google editor acts through the calendar, never as a
 * campaign user; the leader lockdown guard does not apply (no `req.user`).
 * The caller's user is STRIPPED on purpose: a pass triggered by a staff save
 * must not attribute the record to that staff member nor trip the
 * deputy-present reschedule gate.
 * `validateActivitySchedule` runs on the values (malformed → the update
 * throws → the pass fails → `paused`, and the next pass re-asserts Teqo).
 */
const applyGoogleReverseActivityPatch = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  activity: Activity,
  data: {
    title?: string
    startAt?: string | null
    endAt?: string | null
    allDay?: boolean | null
    status?: 'cancelado'
  },
  body: string,
): Promise<void> => {
  await payload.update({
    collection: 'activity',
    id: activity.id,
    data: {
      ...data,
      updates: [...(activity.updates ?? []), { body, author: null }],
    },
    depth: 0,
    // Intentional admin bypass (the Google editor acts through the calendar,
    // never as a campaign user) + the dedicated mutation context that allows
    // the title edit without breaking the canonical-slug contract.
    overrideAccess: true,
    context: { mutationKind: 'googleCalendarSync' },
    req: req ? { ...req, user: undefined } : undefined,
  })
}

const cancelActivityFromGoogle = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  activity: Activity,
): Promise<void> => {
  await applyGoogleReverseActivityPatch(
    payload,
    req,
    activity,
    { status: 'cancelado' },
    buildGoogleReverseCancelBody(),
  )
}

/**
 * The editable v1 fields (D9): title + schedule. `null` per field means the
 * remote value is absent/structural (e.g. a summary that is only the
 * `[Município] ` prefix) — the Teqo re-asserts those through the forward
 * direction on a later pass.
 */
const googleReverseEditOf = (
  event: GoogleRemoteEvent,
  municipalityName?: string,
): GoogleReverseActivityEdit | null => {
  const title = googleTitleFromSummary(event.summary, municipalityName)
  const schedule = googleScheduleToActivityFields(event)
  if (title === null && !schedule) return null
  return { ...(title !== null ? { title } : {}), ...(schedule ?? {}) }
}

/**
 * The reverse decision uses the EDITABLE fields only (summary + schedule):
 * a description/location change in Google stays Teqo-owned and is re-asserted
 * by the forward direction — it must not trigger a reverse edit record.
 */
const googleEditableContentEquals = (
  remote: GoogleRemoteEvent,
  payload: ReturnType<typeof buildGoogleEventPayload>,
): boolean =>
  (remote.summary ?? '') === payload.summary &&
  googleStartEndInstantEquals(remote.start, payload.start) &&
  googleStartEndInstantEquals(remote.end, payload.end)

/**
 * C115 — one full pass, now BIDIRECTIONAL (D2): for every event of ours the
 * diff decides the direction by the clock rule (D3) — Google wins when its
 * `updated` is newer, the Teqo re-asserts otherwise; a `cancelled` event is
 * the user's cancellation (D4); a previously-seen event that vanished is the
 * user's permanent removal. Content equality is checked first, so repeated
 * passes converge without touching Google (C114 D3 preserved).
 * `activityWhere` narrows the mirrored set (C126 — test isolation); the
 * production callers omit it and keep the full staff scope.
 */
const runSyncPass = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  client: GoogleCalendarClient,
  calendarId: string,
  activityWhere: Where | undefined,
  config: GoogleCalendarSyncDoc,
): Promise<SyncCounts> => {
  const { rangeStart, rangeEnd } = buildActivityWindowRange()
  const { activities, municipalityNames } = await loadSyncActivities(payload, req, activityWhere)
  const listWindow = buildListWindow(rangeStart, rangeEnd)
  const remoteEvents = await client.listEvents(calendarId, listWindow)
  const aliveActivityIds = await loadAliveActivityIds(
    payload,
    req,
    listWindow.timeMin,
    listWindow.timeMax,
    activityWhere,
  )

  const snapshot = parseLastSeenSnapshot(config.lastSeenEventIds)
  const lastSeenIds =
    snapshot?.calendarId === calendarId ? new Set(snapshot.ids) : new Set<string>()

  const wantedById = new Map<number, Activity>()
  for (const activity of activities) {
    wantedById.set(activity.id, activity)
  }

  let created = 0
  let updated = 0
  let deleted = 0
  let reverseEdits = 0

  // Ids PRESENT in this pass's remote list (the second loop's "exists" check)
  // — never removed mid-pass. Ids the engine DELETES are tracked separately so
  // the last-seen snapshot excludes them: a trashed event cleaned here must
  // not look "previously seen and gone" to the next pass (which would cancel
  // the activity it was cleaned for — the reopen-after-cancel rule).
  const remoteEventIds = new Set<string>()
  const removedEventIds = new Set<string>()

  for (const event of remoteEvents) {
    // Only OUR deterministic ids are reconciled; foreign events on the
    // campaign calendar (e.g. added manually by the owner) stay untouched —
    // the full decode, never a prefix match (a manual `teqo3` is foreign).
    const activityId = event.id ? decodeGoogleEventActivityId(event.id) : null
    if (activityId === null) continue
    remoteEventIds.add(event.id!)

    const activity = wantedById.get(activityId)

    // C115 — a `cancelled` event is the user's cancellation in Google
    // (trash). A live `confirmado` commitment is cancelled in the Teqo only
    // when the cancel is NEWER than the activity's last mirrored change —
    // otherwise the Teqo changed it after the cancel (a reopen): the trashed
    // event is cleaned instead, and the next pass re-creates it. History
    // (`realizado`) stays untouched; anything dead leaves Google.
    if (event.status === GOOGLE_EVENT_STATUS_CANCELLED) {
      if (activity?.status === 'confirmado') {
        if (googleEditIsNewer(event.updated, activity.lastMirroredChangeAt ?? activity.updatedAt)) {
          await cancelActivityFromGoogle(payload, req, activity)
          reverseEdits += 1
        } else {
          await deleteRemoteEvent(client, calendarId, event.id!)
          removedEventIds.add(event.id!)
          deleted += 1
        }
      } else if (!activity && !aliveActivityIds.has(activityId)) {
        await deleteRemoteEvent(client, calendarId, event.id!)
        removedEventIds.add(event.id!)
        deleted += 1
      }
      continue
    }

    if (!activity) {
      // Not in the push window: alive past/future commitments keep their
      // event; anything else (canceled, hard-deleted) leaves Google.
      if (!aliveActivityIds.has(activityId)) {
        await deleteRemoteEvent(client, calendarId, event.id!)
        removedEventIds.add(event.id!)
        deleted += 1
      }
      continue
    }

    const municipalityId = activityMunicipalityIdOf(activity.municipality)
    const municipalityName = municipalityId ? municipalityNames.get(municipalityId) : undefined
    const googleEvent = buildGoogleEventPayload(activity, municipalityName)

    if (googleEventContentEquals(event, googleEvent)) continue

    // C115 — the clock rule: a NEWER Google edit of an editable field wins;
    // anything else (Teqo newer, structural fields, `realizado` history) is
    // re-asserted by the forward direction. The baseline is the last MIRRORED
    // change (`lastMirroredChangeAt`), not `updatedAt` — task toggles and
    // updates-feed records bump `updatedAt` without ever reaching the mirror.
    if (
      activity.status === 'confirmado' &&
      !googleEditableContentEquals(event, googleEvent) &&
      googleEditIsNewer(event.updated, activity.lastMirroredChangeAt ?? activity.updatedAt)
    ) {
      const reverseEdit = googleReverseEditOf(event, municipalityName)
      if (reverseEdit) {
        const body = buildGoogleReverseUpdateBody(activity, reverseEdit)
        await applyGoogleReverseActivityPatch(payload, req, activity, reverseEdit, body)
        reverseEdits += 1
        continue
      }
    }

    await client.updateEvent(calendarId, event.id!, googleEvent)
    updated += 1
  }

  for (const [activityId, activity] of wantedById) {
    const eventId = googleEventIdForActivity(activityId)
    if (remoteEventIds.has(eventId)) continue

    // C115 — previously seen and now gone: the user permanently removed the
    // event (trash still shows as `cancelled`, handled above). Never seen →
    // a fresh mirror (first activation or calendar switch) → create.
    if (activity.status === 'confirmado' && lastSeenIds.has(eventId)) {
      await cancelActivityFromGoogle(payload, req, activity)
      reverseEdits += 1
      continue
    }

    const municipalityId = activityMunicipalityIdOf(activity.municipality)
    const municipalityName = municipalityId ? municipalityNames.get(municipalityId) : undefined
    await client.insertEvent(calendarId, buildGoogleEventPayload(activity, municipalityName))
    // The created event NOW exists — the last-seen snapshot must include it,
    // or the next pass would treat it as never-created and rebuild it.
    remoteEventIds.add(eventId)
    created += 1
  }

  await recordSyncState(payload, req, {
    lastSeenEventIds: {
      calendarId,
      ids: [...remoteEventIds].filter((id) => !removedEventIds.has(id)),
    },
  })

  return { created, updated, deleted, reverseEdits }
}

type SyncStatePatch = Partial<
  Pick<
    GoogleCalendarSyncDoc,
    | 'lastSyncedAt'
    | 'lastSuccessAt'
    | 'lastErrorAt'
    | 'lastError'
    | 'lastSeenEventIds'
    | 'pushChannelId'
    | 'pushChannelResourceId'
    | 'pushChannelExpiresAt'
    | 'pushChannelSecret'
    | 'pushChannelError'
  >
>

const recordSyncState = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  patch: SyncStatePatch,
): Promise<void> => {
  const doc = await loadGoogleCalendarSyncConfig(payload, req)
  if (!doc) return // nothing to record before the first activation

  await payload.update({
    collection: 'googleCalendarSync',
    id: doc.id,
    data: patch,
    depth: 0,
    // Intentional admin bypass: the state fields are system-only by design.
    overrideAccess: true,
    req,
  })
}

/** The webhook route uses this when Google reports the watched calendar is gone. */
export const recordGoogleCalendarSyncError = async (
  payload: Payload,
  message: string,
): Promise<void> => {
  const at = new Date().toISOString()
  await recordSyncState(payload, undefined, { lastErrorAt: at, lastError: message.slice(0, 500) })
}

/** The push-channel webhook address; the URL secret IS the credential. */
const buildPushChannelAddress = (secret: string): string | null => {
  try {
    return `${getCampaignInviteBaseURL()}${GOOGLE_CALENDAR_WEBHOOK_PATH}${secret}`
  } catch {
    return null
  }
}

const generateChannelSecret = (): string => randomBytes(32).toString('base64url')

/**
 * C115 — D5: keeps a push channel alive on the configured calendar. Lazily
 * ensures (create / renew / re-create after a calendar switch) on EVERY pass,
 * so the channel renews itself through the existing triggers — no cron.
 * Best-effort by contract: a channel failure is recorded in
 * `pushChannelError` and NEVER pauses the mirror — the reverse direction also
 * runs on every local trigger, the channel only buys immediacy.
 */
const ensureGoogleCalendarPushChannel = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  client: GoogleCalendarClient,
  config: GoogleCalendarSyncDoc,
): Promise<void> => {
  const calendarId = config.calendarId
  if (!calendarId) return

  // Fail fast when the site URL is missing (C98 lesson) — the real address is
  // built inside the try with the fresh secret.
  if (!buildPushChannelAddress('probe')) {
    await recordSyncState(payload, req, {
      pushChannelError: 'NEXT_PUBLIC_SITE_URL não configurada — impossível registrar o webhook.',
    })
    return
  }

  const snapshot = parseLastSeenSnapshot(config.lastSeenEventIds)
  const channelWatchesCurrentCalendar = snapshot === null || snapshot.calendarId === calendarId
  const expiringSoon =
    config.pushChannelExpiresAt &&
    new Date(config.pushChannelExpiresAt).getTime() < Date.now() + PUSH_CHANNEL_RENEW_LEAD_MS
  const healthy = Boolean(config.pushChannelId && config.pushChannelResourceId) && !expiringSoon

  if (healthy && channelWatchesCurrentCalendar) {
    if (config.pushChannelError) {
      await recordSyncState(payload, req, { pushChannelError: null })
    }
    return
  }

  try {
    // A FRESH secret per channel creation (rotation): a leaked webhook URL
    // self-heals on the next renewal, and the old channel — stopped below —
    // dies with its URL.
    const secret = generateChannelSecret()
    const address = buildPushChannelAddress(secret)
    if (!address) {
      await recordSyncState(payload, req, {
        pushChannelError: 'NEXT_PUBLIC_SITE_URL não configurada — impossível registrar o webhook.',
      })
      return
    }
    const channel = await client.watchEvents(calendarId, {
      id: randomUUID(),
      address,
      token: secret,
      ttlSeconds: PUSH_CHANNEL_TTL_SECONDS,
    })

    // Persist the NEW channel BEFORE stopping the old one: if the stop fails
    // the replacement is already recorded (no orphaned live channel, no
    // duplicate re-watch on the next pass) — the catch below only records
    // the error.
    await recordSyncState(payload, req, {
      pushChannelId: channel.id,
      pushChannelResourceId: channel.resourceId,
      pushChannelExpiresAt: channel.expiration
        ? new Date(channel.expiration).toISOString()
        : new Date(Date.now() + PUSH_CHANNEL_TTL_SECONDS * 1000).toISOString(),
      pushChannelSecret: secret,
      pushChannelError: null,
    })

    // Best-effort: the old channel is stopped once its replacement is live
    // (Google allows an overlap period; duplicated notifications are
    // idempotent). A failure here never loses the new channel.
    if (config.pushChannelId && config.pushChannelResourceId) {
      await client.stopChannel({
        id: config.pushChannelId,
        resourceId: config.pushChannelResourceId,
      })
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao registrar o webhook do Google.'
    await recordSyncState(payload, req, { pushChannelError: message.slice(0, 500) })
  }
}

export type CampaignCalendarSyncOutcome = SyncCounts & {
  status: GoogleCalendarSyncStatus
  at: string
}

export type CampaignCalendarSyncOptions = {
  reason: 'create' | 'update' | 'delete' | 'config-change' | 'manual' | 'webhook'
  client?: GoogleCalendarClient
  req?: PayloadRequest
  /** C114-LOCK: hook budget that bounds the row lock window (S11 parity). */
  signal?: AbortSignal
  /** Int tests stub the transport; the channel ensure needs it too — off in tests that don't want it. */
  skipChannelEnsure?: boolean
  /**
   * Narrows the mirrored activity set (push + delete-guard). Production
   * callers omit it — the official mirror is the full staff scope. Exists
   * for scoped mirrors and test isolation (e.g. a spec that must not see
   * activities other parallel specs create in the same database).
   */
  activityWhere?: Where
}

export const runCampaignCalendarSync = async (
  payload: Payload,
  options: CampaignCalendarSyncOptions,
): Promise<CampaignCalendarSyncOutcome> => {
  const credentials = readGoogleServiceAccountCredentials()
  const config = await loadGoogleCalendarSyncConfig(payload, options.req)
  const at = new Date().toISOString()

  if (!credentials || !config?.calendarId || config.disabledAt) {
    return {
      status: deriveGoogleCalendarSyncStatus({
        hasCredential: credentials !== null,
        calendarId: config?.calendarId ?? null,
        disabledAt: config?.disabledAt ?? null,
        lastSuccessAt: config?.lastSuccessAt ?? null,
        lastErrorAt: config?.lastErrorAt ?? null,
      }),
      created: 0,
      updated: 0,
      deleted: 0,
      reverseEdits: 0,
      at,
    }
  }

  // C114-LOCK: when the engine is injected with a stub `client` (int tests)
  // the hook `signal` is not plumbed into that instance — the stub must be
  // created with its own signal. Production hooks never inject a client, so
  // the `??` branch covers the row-lock path.
  const client =
    options.client ?? createGoogleCalendarClient(credentials, undefined, options.signal)

  try {
    if (!options.skipChannelEnsure) {
      await ensureGoogleCalendarPushChannel(payload, options.req, client, config)
    }
    const counts = await runSyncPass(
      payload,
      options.req,
      client,
      config.calendarId,
      options.activityWhere,
      config,
    )
    await recordSyncState(payload, options.req, { lastSyncedAt: at, lastSuccessAt: at })
    return { status: 'synced', ...counts, at }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar com o Google.'
    await recordSyncState(payload, options.req, {
      lastSyncedAt: at,
      lastErrorAt: at,
      lastError: message.slice(0, 500),
    })
    return { status: 'paused', created: 0, updated: 0, deleted: 0, reverseEdits: 0, at }
  }
}

/**
 * Normalizes a mirrored field for change detection. The afterChange `doc`
 * carries populated relationships (municipality object) while `previousDoc`
 * comes depth-0 (numeric id) — comparing raw values would flag EVERY update
 * as changed and sync on every task toggle.
 */
const normalizeMirroredField = (doc: Activity | undefined, field: string): unknown => {
  const raw = (doc as unknown as Record<string, unknown> | undefined)?.[field]
  if (field === 'municipality') {
    return activityMunicipalityIdOf(raw as unknown as Activity['municipality']) ?? null
  }
  if (field === 'tags') {
    return Array.isArray(raw) ? [...raw].sort() : raw
  }
  return raw
}

/**
 * Pure guard — the activity hook only runs a sync pass when a field the
 * Google event mirrors changed (task toggles, updates and result records
 * never trigger). Create/delete always sync.
 */
export const shouldSyncActivityOperation = ({
  operation,
  doc,
  previousDoc,
}: {
  operation: 'create' | 'update' | 'delete'
  doc: Activity
  previousDoc?: Activity
}): boolean => {
  if (operation !== 'update') return true
  return SYNC_RELEVANT_ACTIVITY_FIELDS.some(
    (field) =>
      JSON.stringify(normalizeMirroredField(doc, field)) !==
      JSON.stringify(normalizeMirroredField(previousDoc, field)),
  )
}

/**
 * Pure guard — the config hook reconciles on calendarId change or re-enable
 * (D7); state-only writes (the engine recording outcomes) never re-trigger,
 * which is what breaks the would-be loop.
 */
export const shouldSyncConfigChange = ({
  operation,
  doc,
  previousDoc,
}: {
  operation: 'create' | 'update'
  doc: GoogleCalendarSyncDoc
  previousDoc?: GoogleCalendarSyncDoc
}): boolean => {
  if (operation !== 'update') return true
  const calendarChanged = (doc.calendarId ?? '') !== (previousDoc?.calendarId ?? '')
  const disabledCleared = Boolean(previousDoc?.disabledAt) && !doc.disabledAt
  return calendarChanged || disabledCleared
}

/**
 * Activity hook (afterChange + afterDelete) and the `googleCalendarSync`
 * config hook (D7 auto-resync) live in `googleCalendarSyncHooks.ts` — they
 * delegate to the guards above and the engine, and are kept in a separate
 * module so tests can mock the engine at the import boundary.
 */
