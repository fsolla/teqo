// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { googleEventIdForActivity } from '@/lib/googleCalendarEventMapping'
import config from '@/payload.config'
import type { GoogleCalendarClient, GoogleRemoteEvent } from '@/utilities/googleCalendarClient'
import {
  GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV,
  loadGoogleCalendarSyncConfig,
  readGoogleCalendarSyncView,
  runCampaignCalendarSync,
} from '@/utilities/googleCalendarSync'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const FAKE_KEY = Buffer.from(
  JSON.stringify({
    client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  }),
  'utf8',
).toString('base64')

const originalKey = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]

const withCredential = async <T>(run: () => Promise<T>): Promise<T> => {
  process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = FAKE_KEY
  try {
    return await run()
  } finally {
    if (originalKey === undefined) {
      delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    } else {
      process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = originalKey
    }
  }
}

/** In-memory Google calendar stub — list/insert/update/delete over an array. */
const createStubClient = (store: GoogleRemoteEvent[] = []): GoogleCalendarClient => ({
  listEvents: async (_calendarId, range) =>
    store.filter((event) => {
      const start = event.start?.dateTime ?? event.start?.date ?? ''
      return start >= range.timeMin && start <= range.timeMax
    }),
  insertEvent: async (_calendarId, event) => {
    store.push(event)
  },
  updateEvent: async (_calendarId, eventId, event) => {
    const index = store.findIndex((entry) => entry.id === eventId)
    if (index >= 0) store[index] = event
  },
  deleteEvent: async (_calendarId, eventId) => {
    const index = store.findIndex((entry) => entry.id === eventId)
    if (index >= 0) store.splice(index, 1)
  },
})

const calendarA = 'c_campanha_a@group.calendar.google.com'
const calendarB = 'c_campanha_b@group.calendar.google.com'

describe('campaign Google calendar sync engine (C114)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterEach(async () => {
    // Teqo never depends on Google: the engine must never throw into callers.
    // Cleanup happens per test; the env is restored by withCredential.
    await payload.delete({
      collection: 'activity',
      where: { title: { like: 'C114%' } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'googleCalendarSync',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
  })

  const createActivity = async (overrides: Record<string, unknown> = {}) => {
    const municipality = await campaignFixtures().getMunicipality()
    return payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title: `C114 ${crypto.randomUUID().slice(0, 8)}`,
        tags: ['Caminhada'],
        status: 'confirmado',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        municipality: municipality.id,
        ...overrides,
      }),
      depth: 0,
      overrideAccess: true,
    })
  }

  const createConfig = async (calendarId: string) =>
    payload.create({
      collection: 'googleCalendarSync',
      data: { calendarId },
      depth: 0,
      overrideAccess: true,
    })

  it('creates the full mirror on the first pass (timed + all-day, municipality summary)', async () => {
    const municipality = await campaignFixtures().getMunicipality()
    const timed = await createActivity({ municipality: municipality.id, locality: 'Centro' })
    const allDay = await createActivity({
      municipality: municipality.id,
      allDay: true,
      startAt: '2026-08-10T03:00:00.000Z',
      endAt: '2026-08-12T03:00:00.000Z',
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )

    expect(outcome.status).toBe('synced')
    expect(outcome.created).toBe(2)
    expect(outcome.updated).toBe(0)
    expect(outcome.deleted).toBe(0)

    const timedEvent = store.find((event) => event.id === googleEventIdForActivity(timed.id))
    expect(timedEvent?.summary).toBe(`[${municipality.name}] ${timed.title}`)
    expect(timedEvent?.location).toBe('Centro')
    expect(timedEvent?.start).toEqual({ dateTime: expect.stringMatching(/-03:00$/) })

    const allDayEvent = store.find((event) => event.id === googleEventIdForActivity(allDay.id))
    expect(allDayEvent?.start).toEqual({ date: '2026-08-10' })
    expect(allDayEvent?.end).toEqual({ date: '2026-08-13' })

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.lastSuccessAt).toBeTruthy()
    expect(doc?.lastError).toBeNull()
  })

  it('converges: a second pass with no changes touches nothing', async () => {
    await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const first = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(first.created).toBe(1)

    const second = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(second).toMatchObject({ created: 0, updated: 0, deleted: 0, status: 'synced' })
  })

  it('updates only the drifted event and ignores foreign calendar events', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = [
      { id: 'foreign-manual-event', summary: 'Mantido pela conta da campanha' },
    ]
    const client = createStubClient(store)
    await withCredential(() => runCampaignCalendarSync(payload, { reason: 'manual', client }))

    // Title is immutable after creation (canonical slug rule) — drift a
    // mutable mirrored field instead (locality is in the mirror surface).
    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { locality: 'Centro (atualizado)' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.updated).toBe(1)
    expect(outcome.deleted).toBe(0)
    expect(store.find((event) => event.id === 'foreign-manual-event')).toBeTruthy()
    expect(
      store.find((event) => event.id === googleEventIdForActivity(activity.id))?.location,
    ).toBe('Centro (atualizado)')
  })

  it('canceled activities leave Google: their events are deleted, none created', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)
    await withCredential(() => runCampaignCalendarSync(payload, { reason: 'manual', client }))
    expect(store).toHaveLength(1)

    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { status: 'cancelado' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.deleted).toBe(1)
    expect(store).toHaveLength(0)
  })

  it('hard-deleted activities leave no ghost in Google', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)
    await withCredential(() => runCampaignCalendarSync(payload, { reason: 'manual', client }))
    expect(store).toHaveLength(1)

    await payload.delete({ collection: 'activity', id: activity.id, overrideAccess: true })

    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.deleted).toBe(1)
    expect(store).toHaveLength(0)
  })

  it('activities outside the window never reach Google', async () => {
    await createActivity({ startAt: '2029-01-01T12:00:00.000Z' })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.created).toBe(0)
    expect(store).toHaveLength(0)
  })

  it('failures land in paused and the next success recovers to synced', async () => {
    await createActivity()
    await createConfig(calendarA)

    const failingClient: GoogleCalendarClient = {
      ...createStubClient(),
      listEvents: async () => {
        throw new Error('Google fora do ar (simulado)')
      },
    }
    const failed = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: failingClient }),
    )
    expect(failed.status).toBe('paused')

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.lastErrorAt).toBeTruthy()
    expect(doc?.lastError).toContain('Google fora do ar')

    // The pill reads with the credential present (same context the run had).
    const failedView = await withCredential(() => readGoogleCalendarSyncView(payload))
    expect(failedView.status).toBe('paused')

    const store: GoogleRemoteEvent[] = []
    const recovered = await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: createStubClient(store) }),
    )
    expect(recovered.status).toBe('synced')
    expect(recovered.created).toBe(1)
    const recoveredView = await withCredential(() => readGoogleCalendarSyncView(payload))
    expect(recoveredView.status).toBe('synced')
  })

  it('without a credential or calendar the engine is a no-op (fail-closed)', async () => {
    await createActivity()
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    // No config doc, no env key.
    const outcome = await runCampaignCalendarSync(payload, { reason: 'manual', client })
    expect(outcome.status).toBe('not-configured')
    expect(store).toHaveLength(0)

    await createConfig(calendarA)
    // Config present but env key absent (outside withCredential).
    const withoutKey = await runCampaignCalendarSync(payload, { reason: 'manual', client })
    expect(withoutKey.status).toBe('not-configured')
    expect(store).toHaveLength(0)
  })

  it('changing the calendarId reconciles into the new calendar (D7 engine side)', async () => {
    await createActivity()
    await createConfig(calendarA)
    const storeA: GoogleRemoteEvent[] = []
    await withCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: createStubClient(storeA) }),
    )
    expect(storeA).toHaveLength(1)

    const config = await loadGoogleCalendarSyncConfig(payload)
    await payload.update({
      collection: 'googleCalendarSync',
      id: config!.id,
      data: { calendarId: calendarB },
      depth: 0,
      overrideAccess: true,
    })

    const storeB: GoogleRemoteEvent[] = []
    const outcome = await withCredential(() =>
      runCampaignCalendarSync(payload, {
        reason: 'config-change',
        client: createStubClient(storeB),
      }),
    )
    expect(outcome.created).toBe(1)
    expect(storeB).toHaveLength(1)
    // The abandoned calendar keeps its last mirror (documented, no retro-cleanup).
    expect(storeA).toHaveLength(1)
  })
})
