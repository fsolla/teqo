import 'server-only'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'

import {
  activityMunicipalityIdOf,
  buildGoogleEventPayload,
  decodeGoogleEventActivityId,
  googleEventContentEquals,
  googleEventIdForActivity,
} from '@/lib/googleCalendarEventMapping'
import {
  buildActivityWindowRange,
  buildActivityWindowWhereClauses,
  loadMunicipalityNames,
} from '@/utilities/calendarFeed'
import {
  createGoogleCalendarClient,
  GoogleCalendarApiError,
  type GoogleCalendarClient,
  type GoogleCalendarCredentials,
} from '@/utilities/googleCalendarClient'

/**
 * C114 — the campaign→Google calendar reconciliation engine.
 *
 * One full pass per run (D3): load the staff-scope activities in the window,
 * list the calendar's events in a slightly wider window, diff by the
 * deterministic event id (`teqo` + base32hex(activityId)) and create/update/
 * delete — updates only when the content differs, so repeated passes converge
 * without touching Google. Canceled and hard-deleted activities drop out of
 * the wanted set, which deletes their Google event: Teqo keeps the SoT,
 * Google keeps no "canceled" state visible to followers.
 *
 * Triggers (D4): activity afterChange/afterDelete (relevant fields only),
 * agenda-page auto-retry and the manual "Sincronizar agora", plus the
 * `googleCalendarSync` config afterChange (D7: calendarId change / re-enable).
 * The engine NEVER throws into the caller — failures land in the state fields
 * and the status derives to `paused`.
 */

export const GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV = 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY'

/**
 * The list window scans further into the past than the push window so a
 * canceled/deleted event older than the 90-day lookback is still found and
 * deleted (a realistic case: canceling an activity that happened months ago).
 */
const SYNC_DELETE_LOOKBACK_DAYS = 730
const SYNC_LIST_WINDOW_BUFFER_DAYS = 30
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
  // action layer, never per-read.
  const result = await payload.find({
    collection: 'googleCalendarSync',
    limit: 1,
    pagination: false,
    depth: 0,
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
 */
const loadSyncActivities = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<{ activities: Activity[]; municipalityNames: Map<number, string> }> => {
  const { rangeStart, rangeEnd } = buildActivityWindowRange()

  const result = await payload.find({
    collection: 'activity',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'startAt',
    where: { and: buildActivityWindowWhereClauses(rangeStart, rangeEnd) },
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

type SyncCounts = { created: number; updated: number; deleted: number }

const runSyncPass = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  client: GoogleCalendarClient,
  calendarId: string,
): Promise<SyncCounts> => {
  const { rangeStart, rangeEnd } = buildActivityWindowRange()
  const { activities, municipalityNames } = await loadSyncActivities(payload, req)
  const listWindow = buildListWindow(rangeStart, rangeEnd)
  const remoteEvents = await client.listEvents(calendarId, listWindow)
  const aliveActivityIds = await loadAliveActivityIds(
    payload,
    req,
    listWindow.timeMin,
    listWindow.timeMax,
  )

  const wantedById = new Map<number, Activity>()
  for (const activity of activities) {
    wantedById.set(activity.id, activity)
  }

  let created = 0
  let updated = 0
  let deleted = 0

  const remoteEventIds = new Set<string>()

  for (const event of remoteEvents) {
    // Only OUR deterministic ids are reconciled; foreign events on the
    // campaign calendar (e.g. added manually by the owner) stay untouched —
    // the full decode, never a prefix match (a manual `teqo3` is foreign).
    const activityId = event.id ? decodeGoogleEventActivityId(event.id) : null
    if (activityId === null) continue
    remoteEventIds.add(event.id!)

    const activity = wantedById.get(activityId)
    if (!activity) {
      // Not in the push window: alive past/future commitments keep their
      // event; anything else (canceled, hard-deleted) leaves Google.
      if (!aliveActivityIds.has(activityId)) {
        await deleteRemoteEvent(client, calendarId, event.id!)
        deleted += 1
      }
      continue
    }

    const municipalityId = activityMunicipalityIdOf(activity.municipality)
    const municipalityName = municipalityId ? municipalityNames.get(municipalityId) : undefined
    const googleEvent = buildGoogleEventPayload(activity, municipalityName)

    if (!googleEventContentEquals(event, googleEvent)) {
      await client.updateEvent(calendarId, event.id!, googleEvent)
      updated += 1
    }
  }

  for (const [activityId, activity] of wantedById) {
    const eventId = googleEventIdForActivity(activityId)
    if (remoteEventIds.has(eventId)) continue

    const municipalityId = activityMunicipalityIdOf(activity.municipality)
    const municipalityName = municipalityId ? municipalityNames.get(municipalityId) : undefined
    await client.insertEvent(calendarId, buildGoogleEventPayload(activity, municipalityName))
    created += 1
  }

  return { created, updated, deleted }
}

const recordSyncState = async (
  payload: Payload,
  req: PayloadRequest | undefined,
  patch: Partial<
    Pick<GoogleCalendarSyncDoc, 'lastSyncedAt' | 'lastSuccessAt' | 'lastErrorAt' | 'lastError'>
  >,
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

export type CampaignCalendarSyncOutcome = SyncCounts & {
  status: GoogleCalendarSyncStatus
  at: string
}

export type CampaignCalendarSyncOptions = {
  reason: 'create' | 'update' | 'delete' | 'config-change' | 'manual'
  client?: GoogleCalendarClient
  req?: PayloadRequest
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
      at,
    }
  }

  const client = options.client ?? createGoogleCalendarClient(credentials)

  try {
    const counts = await runSyncPass(payload, options.req, client, config.calendarId)
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
    return { status: 'paused', created: 0, updated: 0, deleted: 0, at }
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
