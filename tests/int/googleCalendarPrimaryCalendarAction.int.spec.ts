// @vitest-environment node
//
// C150 — the primary-calendar picker actions. Session resolution is mocked
// (`getCampaignActionContext`), like the sibling action specs; everything else
// — Payload access, the config afterChange hook (D7) and the DB — runs for
// real. The Google client factory is mocked so the listing/validation is
// deterministic: the picker must refuse an id that is not in the connected
// account's LIVE writable list, and choosing a listed one must write
// `calendarId` and reconcile the mirror into it.

import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/utilities/campaignActionContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/campaignActionContext')>()
  return { ...original, getCampaignActionContext: vi.fn() }
})

vi.mock('@/utilities/googleCalendarClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/googleCalendarClient')>()
  return { ...original, createGoogleCalendarClient: vi.fn() }
})

import {
  chooseGoogleCalendar,
  listGoogleCalendars,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import config from '@/payload.config'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import {
  createGoogleCalendarClient,
  GoogleCalendarAuthError,
  type GoogleCalendarClient,
  type GoogleRemoteEvent,
} from '@/utilities/googleCalendarClient'
import {
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
} from '@/utilities/googleCalendarOAuth'
import { loadGoogleCalendarSyncConfig } from '@/utilities/googleCalendarSync'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { serializeGoogleCalendarSyncSpec } from '../helpers/googleCalendarSyncLock'

serializeGoogleCalendarSyncSpec()

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const mockedGetContext = vi.mocked(getCampaignActionContext)
const mockedCreateClient = vi.mocked(createGoogleCalendarClient)

const OAUTH_ENV_KEYS = [
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV,
  GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV,
] as const
const originalEnv = new Map(OAUTH_ENV_KEYS.map((key) => [key, process.env[key]]))

const setOAuthClientEnv = (): void => {
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_ID_ENV] = 'test-client-id'
  process.env[GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET_ENV] = 'test-client-secret'
}

const restoreEnv = (): void => {
  for (const key of OAUTH_ENV_KEYS) {
    const value = originalEnv.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

const CALENDAR_A = 'c_campanha_a@group.calendar.google.com'
const CALENDAR_B = 'c_campanha_b@group.calendar.google.com'

type StubClient = {
  client: GoogleCalendarClient
  listCalendars: ReturnType<typeof vi.fn>
  listEvents: ReturnType<typeof vi.fn>
}

const createStubClient = (): StubClient => {
  const listCalendars = vi.fn(async () => [
    { id: CALENDAR_A, summary: 'Agenda da Campanha', primary: false },
    { id: CALENDAR_B, summary: 'Meu calendário', primary: true },
  ])
  const listEvents = vi.fn(
    async (_calendarId: string, _range: { timeMin: string; timeMax: string }) =>
      [] as GoogleRemoteEvent[],
  )
  const client: GoogleCalendarClient = {
    listCalendars,
    listEvents,
    insertEvent: vi.fn(async () => {}),
    updateEvent: vi.fn(async () => {}),
    deleteEvent: vi.fn(async () => {}),
    watchEvents: vi.fn(async () => ({
      id: 'watch-1',
      resourceId: 'resource-1',
      expiration: null,
    })),
    stopChannel: vi.fn(async () => {}),
  }
  return { client, listCalendars, listEvents }
}

describe('C150 — primary calendar picker actions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  let ownedConfigId: number | null = null

  afterEach(async () => {
    restoreEnv()
    if (ownedConfigId !== null) {
      // Scoped to OUR row: the sibling Google specs share the test DB and
      // their own config lifecycle must not be robbed by this file's cleanup.
      await payload.delete({
        collection: 'googleCalendarSync',
        id: ownedConfigId,
        overrideAccess: true,
      })
      ownedConfigId = null
    }
    mockedGetContext.mockReset()
    mockedCreateClient.mockReset()
  })

  afterAll(() => {
    restoreEnv()
  })

  const installActor = async (role: 'coordinator' | 'advisor'): Promise<void> => {
    const actor = await campaignFixtures().createCampaignUser(role)
    mockedGetContext.mockResolvedValue({ payload, actor })
  }

  const createConnectedConfig = async (calendarId: string | null = null) => {
    const doc = await payload.create({
      collection: 'googleCalendarSync',
      data: {
        calendarId,
        oauthRefreshToken: 'c150-refresh-token',
        oauthConnectedAt: new Date().toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    })
    ownedConfigId = doc.id
    return doc
  }

  it('refuses an advisor on list and choose without touching the row', async () => {
    await installActor('advisor')
    await createConnectedConfig(CALENDAR_A)
    setOAuthClientEnv()

    const list = await listGoogleCalendars()
    expect(list.ok).toBe(false)
    if (list.ok) throw new Error('list must be refused')
    expect(list.message).toContain('candidato ou coordenação')

    const choose = await chooseGoogleCalendar(CALENDAR_B)
    expect(choose.ok).toBe(false)
    expect(choose.message).toContain('candidato ou coordenação')

    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.calendarId).toBe(CALENDAR_A)
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('lists the writable calendars of the connected account for a coordinator', async () => {
    await installActor('coordinator')
    await createConnectedConfig()
    setOAuthClientEnv()
    const stub = createStubClient()
    mockedCreateClient.mockReturnValue(stub.client)

    const result = await listGoogleCalendars()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('list must succeed')
    expect(result.calendars).toEqual([
      { id: CALENDAR_A, summary: 'Agenda da Campanha', primary: false },
      { id: CALENDAR_B, summary: 'Meu calendário', primary: true },
    ])
    expect(mockedCreateClient).toHaveBeenCalledTimes(1)
  })

  it('records a dead OAuth connection and surfaces it as an auth error', async () => {
    await installActor('coordinator')
    await createConnectedConfig()
    setOAuthClientEnv()
    const stub = createStubClient()
    stub.listCalendars.mockRejectedValue(
      new GoogleCalendarAuthError('A conexão com o Google expirou ou foi revogada. Reconecte.'),
    )
    mockedCreateClient.mockReturnValue(stub.client)

    const result = await listGoogleCalendars()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('list must fail')
    expect(result.message).toContain('Reconecte')
    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.oauthErrorAt).toBeTruthy()
    expect(doc?.oauthError).toContain('Reconecte')
  })

  it('rejects an id outside the live writable list without writing', async () => {
    await installActor('coordinator')
    await createConnectedConfig(CALENDAR_A)
    setOAuthClientEnv()
    const stub = createStubClient()
    stub.listCalendars.mockResolvedValue([
      { id: CALENDAR_A, summary: 'Agenda da Campanha', primary: false },
    ])
    mockedCreateClient.mockReturnValue(stub.client)

    const result = await chooseGoogleCalendar(CALENDAR_B)

    expect(result.ok).toBe(false)
    expect(result.message).toContain('não está mais disponível')
    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.calendarId).toBe(CALENDAR_A)
  })

  it('writes a listed calendar and reconciles the mirror into it (D7)', async () => {
    await installActor('coordinator')
    await createConnectedConfig(CALENDAR_A)
    setOAuthClientEnv()
    const stub = createStubClient()
    mockedCreateClient.mockReturnValue(stub.client)

    const result = await chooseGoogleCalendar(CALENDAR_B)

    expect(result.ok).toBe(true)
    expect(result.calendarId).toBe(CALENDAR_B)
    expect(result.addLink).toBe(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_B)}`,
    )
    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.calendarId).toBe(CALENDAR_B)
    // The config afterChange hook (D7) ran a pass against the NEW calendar and
    // succeeded with the stub transport.
    expect(stub.listEvents).toHaveBeenCalled()
    expect(stub.listEvents.mock.calls[0][0]).toBe(CALENDAR_B)
    expect(doc?.lastSuccessAt).toBeTruthy()
  })

  it('keeps the current calendar as a no-op without listing', async () => {
    await installActor('coordinator')
    await createConnectedConfig(CALENDAR_A)
    setOAuthClientEnv()
    const stub = createStubClient()
    mockedCreateClient.mockReturnValue(stub.client)

    const result = await chooseGoogleCalendar(CALENDAR_A)

    expect(result.ok).toBe(true)
    expect(result.calendarId).toBe(CALENDAR_A)
    expect(stub.listCalendars).not.toHaveBeenCalled()
    expect(stub.listEvents).not.toHaveBeenCalled()
  })
})
