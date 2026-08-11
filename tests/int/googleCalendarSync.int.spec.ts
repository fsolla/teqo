// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { allDayCivilDateOf, allDayExclusiveEndDate } from '@/lib/activityAllDay'
import { googleEventIdForActivity } from '@/lib/googleCalendarEventMapping'
import config from '@/payload.config'
import type { GoogleCalendarClient, GoogleRemoteEvent } from '@/utilities/googleCalendarClient'
import {
  loadGoogleCalendarSyncConfig,
  readGoogleCalendarSyncView,
  runCampaignCalendarSync,
} from '@/utilities/googleCalendarSync'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { withGoogleCalendarTestCredential } from '../helpers/googleCalendarTestKey'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

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

  /** Config rows this file created — cleanup never touches other specs' rows. */
  const ownedConfigIds = new Set<number>()

  afterEach(async () => {
    // Teqo never depends on Google: the engine must never throw into callers.
    // Cleanup happens per test; the env is restored by the credential helper.
    await payload.delete({
      collection: 'activity',
      where: { title: { like: 'C114%' } },
      overrideAccess: true,
    })
    for (const id of ownedConfigIds) {
      await payload.delete({ collection: 'googleCalendarSync', id, overrideAccess: true })
    }
    ownedConfigIds.clear()
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

  const createConfig = async (calendarId: string) => {
    const doc = await payload.create({
      collection: 'googleCalendarSync',
      data: { calendarId },
      depth: 0,
      overrideAccess: true,
    })
    ownedConfigIds.add(doc.id)
    return doc
  }

  /**
   * The mirror is the WHOLE staff scope (espelho cheio) — parallel spec files
   * create activities on the same test DB while this file runs, so the
   * engine's absolute created/updated/deleted counts are not deterministic
   * here. The assertions are therefore scoped to this spec's own activities
   * via their deterministic event ids, which IS the engine's contract.
   */
  const ourEvent = (store: GoogleRemoteEvent[], activityId: number) =>
    store.find((event) => event.id === googleEventIdForActivity(activityId))

  const ourEvents = (store: GoogleRemoteEvent[], activityId: number) =>
    store.filter((event) => event.id === googleEventIdForActivity(activityId))

  it('creates the full mirror on the first pass (timed + all-day, municipality summary)', async () => {
    const municipality = await campaignFixtures().getMunicipality()
    const timed = await createActivity({ municipality: municipality.id, locality: 'Centro' })
    // C127: dates derived from now — hardcoded instants would leave the sync
    // window and break the assertion deterministically after ~90 days.
    const allDayStartAt = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const allDayEndAt = new Date(Date.now() + 4 * 86_400_000).toISOString()
    const allDay = await createActivity({
      municipality: municipality.id,
      allDay: true,
      startAt: allDayStartAt,
      endAt: allDayEndAt,
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )

    expect(outcome.status).toBe('synced')

    const timedEvent = ourEvent(store, timed.id)
    expect(timedEvent?.summary).toBe(`[${municipality.name}] ${timed.title}`)
    expect(timedEvent?.location).toBe('Centro')
    expect(timedEvent?.start).toEqual({ dateTime: expect.stringMatching(/-03:00$/) })

    const allDayEvent = ourEvent(store, allDay.id)
    expect(allDayEvent?.start).toEqual({ date: allDayCivilDateOf(allDayStartAt) })
    expect(allDayEvent?.end).toEqual({ date: allDayExclusiveEndDate(allDayEndAt) })

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.lastSuccessAt).toBeTruthy()
    expect(doc?.lastError).toBeNull()
  })

  it('converges: a second pass with no changes touches nothing', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const first = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(first.status).toBe('synced')
    expect(ourEvent(store, activity.id)).toBeTruthy()
    const contentAfterFirstPass = JSON.stringify(ourEvent(store, activity.id))

    const second = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(second.status).toBe('synced')
    // Idempotence, scoped to our activity: still exactly one event with the
    // same content — no re-create, no update, no delete.
    expect(ourEvents(store, activity.id)).toHaveLength(1)
    expect(JSON.stringify(ourEvent(store, activity.id))).toBe(contentAfterFirstPass)
  })

  it('updates only the drifted event and ignores foreign calendar events', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = [
      { id: 'foreign-manual-event', summary: 'Mantido pela conta da campanha' },
    ]
    const client = createStubClient(store)
    await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )

    // Title is immutable after creation (canonical slug rule) — drift a
    // mutable mirrored field instead (locality is in the mirror surface).
    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { locality: 'Centro (atualizado)' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.status).toBe('synced')
    expect(store.find((event) => event.id === 'foreign-manual-event')).toBeTruthy()
    expect(ourEvent(store, activity.id)?.location).toBe('Centro (atualizado)')
  })

  it('canceled activities leave Google: their events are deleted, none created', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)
    await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(ourEvent(store, activity.id)).toBeTruthy()

    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { status: 'cancelado' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.status).toBe('synced')
    expect(ourEvent(store, activity.id)).toBeUndefined()
  })

  it('hard-deleted activities leave no ghost in Google', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)
    await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(ourEvent(store, activity.id)).toBeTruthy()

    await payload.delete({ collection: 'activity', id: activity.id, overrideAccess: true })

    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.status).toBe('synced')
    expect(ourEvent(store, activity.id)).toBeUndefined()
  })

  it('activities outside the window never reach Google', async () => {
    // C127: now + 400 days — far beyond the ~90-day push window, but never
    // hardcoded (a fixed far date would ENTER the window as it approaches).
    const activity = await createActivity({
      startAt: new Date(Date.now() + 400 * 86_400_000).toISOString(),
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client }),
    )
    expect(outcome.status).toBe('synced')
    expect(ourEvent(store, activity.id)).toBeUndefined()
  })

  it('failures land in paused and the next success recovers to synced', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)

    const failingClient: GoogleCalendarClient = {
      ...createStubClient(),
      listEvents: async () => {
        throw new Error('Google fora do ar (simulado)')
      },
    }
    const failed = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: failingClient }),
    )
    expect(failed.status).toBe('paused')

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.lastErrorAt).toBeTruthy()
    expect(doc?.lastError).toContain('Google fora do ar')

    // The pill reads with the credential present (same context the run had).
    const failedView = await withGoogleCalendarTestCredential(() =>
      readGoogleCalendarSyncView(payload),
    )
    expect(failedView.status).toBe('paused')

    const store: GoogleRemoteEvent[] = []
    const recovered = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: createStubClient(store) }),
    )
    expect(recovered.status).toBe('synced')
    expect(ourEvent(store, activity.id)).toBeTruthy()
    const recoveredView = await withGoogleCalendarTestCredential(() =>
      readGoogleCalendarSyncView(payload),
    )
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
    const activity = await createActivity()
    await createConfig(calendarA)
    const storeA: GoogleRemoteEvent[] = []
    await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, { reason: 'manual', client: createStubClient(storeA) }),
    )
    expect(ourEvent(storeA, activity.id)).toBeTruthy()

    const config = await loadGoogleCalendarSyncConfig(payload)
    await payload.update({
      collection: 'googleCalendarSync',
      id: config!.id,
      data: { calendarId: calendarB },
      depth: 0,
      overrideAccess: true,
    })

    const storeB: GoogleRemoteEvent[] = []
    const outcome = await withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, {
        reason: 'config-change',
        client: createStubClient(storeB),
      }),
    )
    expect(outcome.status).toBe('synced')
    expect(ourEvent(storeB, activity.id)).toBeTruthy()
    // The abandoned calendar keeps its last mirror (documented, no retro-cleanup).
    expect(ourEvent(storeA, activity.id)).toBeTruthy()
  })
})
