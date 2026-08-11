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
  watchEvents: async () => ({
    id: 'watch-' + crypto.randomUUID(),
    resourceId: 'resource-' + crypto.randomUUID(),
    expiration: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }),
  stopChannel: async () => {},
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

  describe('bidirectional reconciliation (C115)', () => {
    /** UTC ISO → the `-03:00` dateTime shape the Calendar API echoes. */
    const formatBahiaDateTime = (iso: string): string =>
      `${new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 19)}-03:00`

    const replaceEvent = (
      store: GoogleRemoteEvent[],
      eventId: string,
      patch: Partial<GoogleRemoteEvent>,
    ) => {
      const index = store.findIndex((entry) => entry.id === eventId)
      store[index] = { ...store[index], ...patch }
    }

    const reloadActivity = async (id: number) =>
      payload.findByID({
        collection: 'activity',
        id,
        depth: 0,
        overrideAccess: true,
      })

    it('a newer Google edit applies title and schedule back with an audit record, then converges', async () => {
      const municipality = await campaignFixtures().getMunicipality()
      const activity = await createActivity({ municipality: municipality.id })
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      // The renamed title keeps the `C114 ` cleanup prefix so the file's
      // afterEach can still reach this activity.
      const renamedTitle = `C114 ${crypto.randomUUID().slice(0, 8)} (renomeada no Google)`
      const eventId = googleEventIdForActivity(activity.id)
      const originalStart = new Date(store.find((entry) => entry.id === eventId)!.start!.dateTime!)
      const newStart = new Date(originalStart.getTime() + 3_600_000)
      replaceEvent(store, eventId, {
        summary: `[${municipality.name}] ${renamedTitle}`,
        start: { dateTime: formatBahiaDateTime(newStart.toISOString()) },
        end: { dateTime: formatBahiaDateTime(new Date(newStart.getTime() + 3_600_000).toISOString()) },
        updated: new Date(Date.now() + 60_000).toISOString(),
      })

      const outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)
      expect(outcome.updated).toBe(0)

      const reloaded = await reloadActivity(activity.id)
      expect(reloaded.title).toBe(renamedTitle)
      expect(reloaded.slug).toBe(activity.slug)
      expect(new Date(reloaded.startAt!).getTime()).toBe(newStart.getTime())
      const record = (reloaded.updates ?? []).at(-1)
      expect(record?.body).toContain('Google Calendar:')
      expect(record?.author).toBeNull()

      // Converges: the next pass touches nothing (no loop).
      const again = await runSync(client)
      expect(again).toMatchObject({ updated: 0, deleted: 0, reverseEdits: 0 })
      expect(store).toHaveLength(1)
    })

    it('an older Google edit loses the clock rule — the Teqo re-asserts', async () => {
      const municipality = await campaignFixtures().getMunicipality()
      const activity = await createActivity({ municipality: municipality.id })
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      replaceEvent(store, googleEventIdForActivity(activity.id), {
        summary: `[${municipality.name}] Editado antes do Teqo`,
        updated: new Date(Date.now() - 60_000).toISOString(),
      })

      const outcome = await runSync(client)
      expect(outcome.updated).toBe(1)
      expect(outcome.reverseEdits).toBe(0)

      const reloaded = await reloadActivity(activity.id)
      expect(reloaded.title).not.toBe('Editado antes do Teqo')
      expect(store.find((entry) => entry.id === googleEventIdForActivity(activity.id))?.summary).toBe(
        `[${municipality.name}] ${activity.title}`,
      )
    })

    it('a cancelled event in Google cancels the confirmado activity, then the trash is cleaned', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      // The cancel carries Google's own `updated` clock (newer than the
      // activity's last mirrored change) — otherwise the clock rule would
      // treat it as a stale cancel and clean the trash instead.
      replaceEvent(store, googleEventIdForActivity(activity.id), {
        status: 'cancelled',
        updated: new Date(Date.now() + 60_000).toISOString(),
      })

      const outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)
      const reloaded = await reloadActivity(activity.id)
      expect(reloaded.status).toBe('cancelado')
      expect((reloaded.updates ?? []).at(-1)?.body).toContain('Google Calendar: cancelada')

      // The trashed event leaves Google on the next pass (Teqo SoT).
      const cleanup = await runSync(client)
      expect(cleanup.deleted).toBe(1)
      expect(store).toHaveLength(0)
    })

    it('a permanently removed event cancels the activity (snapshot rule)', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)
      expect(store).toHaveLength(1)

      store.splice(0, 1)

      const outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)
      expect((await reloadActivity(activity.id)).status).toBe('cancelado')
    })

    it('a failed creation is never "seen" — the next pass creates instead of cancelling', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const flakyClient: GoogleCalendarClient = {
        ...createStubClient(store),
        insertEvent: async () => {
          throw new Error('falha simulada na criação')
        },
      }

      const failed = await runSync(flakyClient)
      expect(failed.status).toBe('paused')

      const recovered = await runSync(createStubClient(store))
      expect(recovered.created).toBe(1)
      expect(recovered.reverseEdits).toBe(0)
      expect((await reloadActivity(activity.id)).status).toBe('confirmado')
    })

    it('switching calendars re-creates the mirror without cancelling, and re-watches the channel', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const storeA: GoogleRemoteEvent[] = []
      const watched: string[] = []
      const stopped: Array<{ id: string; resourceId: string }> = []
      const client: GoogleCalendarClient = {
        ...createStubClient(storeA),
        watchEvents: async (calendarId) => {
          watched.push(calendarId)
          return {
            id: 'watch-' + watched.length,
            resourceId: 'resource-' + watched.length,
            expiration: Date.now() + 30 * 86_400_000,
          }
        },
        stopChannel: async (channel) => {
          stopped.push(channel)
        },
      }
      await runSync(client)
      expect(watched).toEqual([calendarA])
      expect(storeA).toHaveLength(1)

      const config = await loadGoogleCalendarSyncConfig(payload)
      await payload.update({
        collection: 'googleCalendarSync',
        id: config!.id,
        data: { calendarId: calendarB },
        depth: 0,
        overrideAccess: true,
      })
      storeA.length = 0

      const outcome = await runSync(client, 'config-change')
      expect(outcome.created).toBe(1)
      expect(outcome.reverseEdits).toBe(0)
      expect(storeA).toHaveLength(1)
      expect((await reloadActivity(activity.id)).status).toBe('confirmado')
      // Channel re-created for the new calendar; the old one stopped.
      expect(watched).toEqual([calendarA, calendarB])
      expect(stopped).toEqual([{ id: 'watch-1', resourceId: 'resource-1' }])
    })

    it('a newer Google edit never touches realizado history', async () => {
      const municipality = await campaignFixtures().getMunicipality()
      const activity = await createActivity({ municipality: municipality.id, status: 'realizado' })
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      replaceEvent(store, googleEventIdForActivity(activity.id), {
        summary: `[${municipality.name}] Editado depois`,
        updated: new Date(Date.now() + 60_000).toISOString(),
      })

      const outcome = await runSync(client)
      expect(outcome.updated).toBe(1)
      expect(outcome.reverseEdits).toBe(0)
      expect((await reloadActivity(activity.id)).status).toBe('realizado')
    })

    it('a description-only drift is Teqo-owned: forward re-asserts without a reverse record', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      replaceEvent(store, googleEventIdForActivity(activity.id), {
        description: 'descrição adulterada no Google',
      })

      const outcome = await runSync(client)
      expect(outcome.updated).toBe(1)
      expect(outcome.reverseEdits).toBe(0)
      expect((await reloadActivity(activity.id)).updates ?? []).toHaveLength(0)
    })

    it('ensures a push channel on the first pass and renews before expiry with a fresh id', async () => {
      await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const watched: Array<{ calendarId: string; channel: { id: string; token: string; address: string } }> = []
      const stopped: Array<{ id: string; resourceId: string }> = []
      const client: GoogleCalendarClient = {
        ...createStubClient(store),
        watchEvents: async (calendarId, channel) => {
          watched.push({ calendarId, channel })
          return {
            id: 'watch-' + watched.length,
            resourceId: 'resource-' + watched.length,
            expiration: Date.now() + 30 * 86_400_000,
          }
        },
        stopChannel: async (channel) => {
          stopped.push(channel)
        },
      }
      await runSync(client)

      let doc = await loadGoogleCalendarSyncConfig(payload)
      expect(watched).toHaveLength(1)
      expect(watched[0].channel.address).toContain('/campanha/agenda/google-webhook/')
      expect(watched[0].channel.token).toBe(doc?.pushChannelSecret)
      expect(doc?.pushChannelId).toBe('watch-1')
      expect(doc?.pushChannelSecret).toHaveLength(43)
      expect(doc?.pushChannelError).toBeNull()

      // Expiring soon → renewal with a NEW unique id + stop of the old
      // channel; the URL secret ROTATES per channel (a leaked URL self-heals
      // on the next renewal).
      await payload.update({
        collection: 'googleCalendarSync',
        id: doc!.id,
        data: { pushChannelExpiresAt: new Date(Date.now() + 60_000).toISOString() },
        depth: 0,
        overrideAccess: true,
      })
      await runSync(client)

      doc = await loadGoogleCalendarSyncConfig(payload)
      expect(watched).toHaveLength(2)
      expect(stopped).toEqual([{ id: 'watch-1', resourceId: 'resource-1' }])
      expect(doc?.pushChannelId).toBe('watch-2')
      expect(doc?.pushChannelSecret).toBe(watched[1].channel.token)
      expect(doc?.pushChannelSecret).not.toBe(watched[0].channel.token)
    })

    it('a channel failure is recorded but never pauses the mirror', async () => {
      await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client: GoogleCalendarClient = {
        ...createStubClient(store),
        watchEvents: async () => {
          throw new Error('watch indisponível (simulado)')
        },
      }

      const outcome = await runSync(client)
      expect(outcome.status).toBe('synced')
      expect(outcome.created).toBe(1)

      const doc = await loadGoogleCalendarSyncConfig(payload)
      expect(doc?.pushChannelError).toContain('watch indisponível')
      expect(doc?.pushChannelId).toBeNull()
    })

    it('a newer all-day Google edit round-trips through the reverse path', async () => {
      const municipality = await campaignFixtures().getMunicipality()
      const activity = await createActivity({ municipality: municipality.id })
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      // C127: dates derived from now — hardcoded instants would leave the
      // sync window and break the assertion deterministically after ~90 days.
      const startCivil = allDayCivilDateOf(new Date(Date.now() + 2 * 86_400_000).toISOString())
      const endExclusive = allDayCivilDateOf(new Date(Date.now() + 4 * 86_400_000).toISOString())
      const expectedStartAt = new Date(Date.now() + 2 * 86_400_000)
      expectedStartAt.setUTCHours(3, 0, 0, 0)
      const expectedEndAt = new Date(expectedStartAt.getTime() + 2 * 86_400_000)

      replaceEvent(store, googleEventIdForActivity(activity.id), {
        start: { date: startCivil },
        end: { date: endExclusive },
        updated: new Date(Date.now() + 60_000).toISOString(),
      })

      const outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)

      const reloaded = await reloadActivity(activity.id)
      expect(reloaded.allDay).toBe(true)
      expect(new Date(reloaded.startAt!).getTime()).toBe(expectedStartAt.getTime())
      expect(new Date(reloaded.endAt!).getTime()).toBe(expectedEndAt.getTime())
      expect((reloaded.updates ?? []).at(-1)?.body).toContain('remarcada')

      // Converges — the forward does not flip allDay back.
      const again = await runSync(client)
      expect(again).toMatchObject({ updated: 0, deleted: 0, reverseEdits: 0 })
      expect(store).toHaveLength(1)
    })

    it('a pending newer Google edit survives a task toggle (clock baseline = lastMirroredChangeAt)', async () => {
      const municipality = await campaignFixtures().getMunicipality()
      const activity = await createActivity({ municipality: municipality.id })
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      // Google edit lands (newer than the last mirrored change)…
      const googleTitle = `C114 ${crypto.randomUUID().slice(0, 8)} (título do Google)`
      replaceEvent(store, googleEventIdForActivity(activity.id), {
        summary: `[${municipality.name}] ${googleTitle}`,
        updated: new Date(Date.now() + 60_000).toISOString(),
      })
      // …and a task toggle bumps `updatedAt` BEFORE the pass runs (it never
      // reaches the mirror — no pass, no stamp).
      await payload.update({
        collection: 'activity',
        id: activity.id,
        data: { tasks: [{ title: 'Convidar a rádio', done: true }] },
        depth: 0,
        overrideAccess: true,
      })

      const outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)
      expect((await reloadActivity(activity.id)).title).toBe(googleTitle)
    })

    it('a staff reopen after a Google cancel is not re-cancelled', async () => {
      const activity = await createActivity()
      await createConfig(calendarA)
      const store: GoogleRemoteEvent[] = []
      const client = createStubClient(store)
      await runSync(client)

      // 1) user cancels in Google — the cancel beats the 2s clock tolerance
      // (anchored on the last mirrored change), so the activity is cancelled.
      const stampedAt = (await reloadActivity(activity.id)).lastMirroredChangeAt!
      replaceEvent(store, googleEventIdForActivity(activity.id), {
        status: 'cancelled',
        updated: new Date(new Date(stampedAt).getTime() + 5_000).toISOString(),
      })
      let outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(1)
      expect((await reloadActivity(activity.id)).status).toBe('cancelado')

      // 2) staff reopens the activity AFTER the cancel instant — the next
      // pass must NOT re-cancel: the trashed event is cleaned instead.
      await new Promise((resolve) => setTimeout(resolve, 3_500))
      await payload.update({
        collection: 'activity',
        id: activity.id,
        data: { status: 'confirmado' },
        depth: 0,
        overrideAccess: true,
      })
      outcome = await runSync(client)
      expect(outcome.reverseEdits).toBe(0)
      expect(outcome.deleted).toBe(1)

      // 3) …and a fresh event is created for the reopened commitment.
      outcome = await runSync(client)
      expect(outcome.created).toBe(1)
      expect((await reloadActivity(activity.id)).status).toBe('confirmado')
    })
  })
})
