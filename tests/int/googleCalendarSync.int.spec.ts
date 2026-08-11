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
  type CampaignCalendarSyncOptions,
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
   * Runs a sync pass scoped to THIS spec's fixture (`C114%` titles). The int
   * suite runs files in parallel against one shared database and other specs
   * create activities inside the mirror window — a full-scope pass would count
   * them and flake the global assertions (C126). Production callers omit the
   * scope and keep the espelho cheio.
   */
  const runSync = (
    client: GoogleCalendarClient,
    reason: CampaignCalendarSyncOptions['reason'] = 'manual',
  ) =>
    withGoogleCalendarTestCredential(() =>
      runCampaignCalendarSync(payload, {
        reason,
        client,
        activityWhere: { title: { like: 'C114%' } },
      }),
    )

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

    const outcome = await runSync(client)

    expect(outcome.status).toBe('synced')
    expect(outcome.created).toBe(2)
    expect(outcome.updated).toBe(0)
    expect(outcome.deleted).toBe(0)

    const timedEvent = store.find((event) => event.id === googleEventIdForActivity(timed.id))
    expect(timedEvent?.summary).toBe(`[${municipality.name}] ${timed.title}`)
    expect(timedEvent?.location).toBe('Centro')
    expect(timedEvent?.start).toEqual({ dateTime: expect.stringMatching(/-03:00$/) })

    const allDayEvent = store.find((event) => event.id === googleEventIdForActivity(allDay.id))
    expect(allDayEvent?.start).toEqual({ date: allDayCivilDateOf(allDayStartAt) })
    expect(allDayEvent?.end).toEqual({ date: allDayExclusiveEndDate(allDayEndAt) })

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.lastSuccessAt).toBeTruthy()
    expect(doc?.lastError).toBeNull()
  })

  it('mirrors only the fixture scope — a foreign in-window activity stays out (C126)', async () => {
    const activity = await createActivity()
    // A row "from another spec": inside the mirror window but outside the
    // C114 fixture scope. The int suite runs files in parallel against one
    // shared database, so such rows exist at arbitrary times — the mirror
    // must not count them (the C126 race).
    const foreign = await createActivity({
      title: `C126 alheia ${crypto.randomUUID().slice(0, 8)}`,
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    try {
      const outcome = await runSync(client)
      expect(outcome.created).toBe(1)
      expect(store).toHaveLength(1)
      expect(store.find((event) => event.id === googleEventIdForActivity(activity.id))).toBeTruthy()
      expect(
        store.find((event) => event.id === googleEventIdForActivity(foreign.id)),
      ).toBeUndefined()
    } finally {
      // The afterEach only cleans `C114%` titles — never leak the foreign
      // row into other specs (the exact bug this pin guards against). The
      // fixture proxy also auto-owns it, but the explicit delete keeps the
      // guarantee visible here.
      if (foreign) {
        await payload.delete({ collection: 'activity', id: foreign.id, overrideAccess: true })
      }
    }
  })

  it('the delete guard honors the scope: an out-of-scope alive event is removed (C126)', async () => {
    await createActivity()
    // Alive and inside the mirror window, but outside the C114 fixture
    // scope. A scoped mirror is authoritative for its scope — its teqo
    // events are reconciled even when the delete-guard's full-scope view
    // would have kept them.
    const foreign = await createActivity({
      title: `C126 alheia ${crypto.randomUUID().slice(0, 8)}`,
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = [
      {
        id: googleEventIdForActivity(foreign.id),
        summary: 'Evento alheio',
        start: { dateTime: new Date(Date.now() + 86_400_000).toISOString() },
      },
    ]
    const client = createStubClient(store)

    try {
      const outcome = await runSync(client)
      expect(outcome.deleted).toBe(1)
      // The in-scope activity is still mirrored on the same pass.
      expect(outcome.created).toBe(1)
      expect(store.some((event) => event.id === googleEventIdForActivity(foreign.id))).toBe(false)
    } finally {
      if (foreign) {
        await payload.delete({ collection: 'activity', id: foreign.id, overrideAccess: true })
      }
    }
  })

  it('converges: a second pass with no changes touches nothing', async () => {
    await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const first = await runSync(client)
    expect(first.created).toBe(1)

    const second = await runSync(client)
    expect(second).toMatchObject({ created: 0, updated: 0, deleted: 0, status: 'synced' })
  })

  it('updates only the drifted event and ignores foreign calendar events', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = [
      { id: 'foreign-manual-event', summary: 'Mantido pela conta da campanha' },
    ]
    const client = createStubClient(store)
    await runSync(client)

    // Title is immutable after creation (canonical slug rule) — drift a
    // mutable mirrored field instead (locality is in the mirror surface).
    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { locality: 'Centro (atualizado)' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await runSync(client)
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
    await runSync(client)
    expect(store).toHaveLength(1)

    await payload.update({
      collection: 'activity',
      id: activity.id,
      data: { status: 'cancelado' },
      depth: 0,
      overrideAccess: true,
    })

    const outcome = await runSync(client)
    expect(outcome.deleted).toBe(1)
    expect(store).toHaveLength(0)
  })

  it('hard-deleted activities leave no ghost in Google', async () => {
    const activity = await createActivity()
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)
    await runSync(client)
    expect(store).toHaveLength(1)

    await payload.delete({ collection: 'activity', id: activity.id, overrideAccess: true })

    const outcome = await runSync(client)
    expect(outcome.deleted).toBe(1)
    expect(store).toHaveLength(0)
  })

  it('activities outside the window never reach Google', async () => {
    // C127: now + 400 days — far beyond the ~90-day push window, but never
    // hardcoded (a fixed far date would ENTER the window as it approaches).
    await createActivity({
      startAt: new Date(Date.now() + 400 * 86_400_000).toISOString(),
    })
    await createConfig(calendarA)
    const store: GoogleRemoteEvent[] = []
    const client = createStubClient(store)

    const outcome = await runSync(client)
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
    const failed = await runSync(failingClient)
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
    const recovered = await runSync(createStubClient(store))
    expect(recovered.status).toBe('synced')
    expect(recovered.created).toBe(1)
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
    // Config present but env key absent (outside the credential helper).
    const withoutKey = await runCampaignCalendarSync(payload, { reason: 'manual', client })
    expect(withoutKey.status).toBe('not-configured')
    expect(store).toHaveLength(0)
  })

  it('changing the calendarId reconciles into the new calendar (D7 engine side)', async () => {
    await createActivity()
    await createConfig(calendarA)
    const storeA: GoogleRemoteEvent[] = []
    await runSync(createStubClient(storeA))
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
    const outcome = await runSync(createStubClient(storeB), 'config-change')
    expect(outcome.created).toBe(1)
    expect(storeB).toHaveLength(1)
    // The abandoned calendar keeps its last mirror (documented, no retro-cleanup).
    expect(storeA).toHaveLength(1)
  })
})
