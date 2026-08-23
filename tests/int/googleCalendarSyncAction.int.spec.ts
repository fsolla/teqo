// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  setGoogleCalendarSyncDisabled,
  type GoogleCalendarSyncActionResult,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import config from '@/payload.config'
import { loadGoogleCalendarSyncConfig } from '@/utilities/googleCalendarSync'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { withGoogleCalendarTestCredential } from '../helpers/googleCalendarTestKey'

/**
 * S18 (C122) — the staff disable/re-enable action (D7). The action reads the
 * session via `getCampaignActionContext` (next/headers cookies — not
 * invocable in a plain process), so only THAT module is mocked: the payload
 * writes, collection access and the afterChange hook run for real. The
 * re-enable reconciliation is observed by its DB effect — the engine records
 * `lastErrorAt` inside the config hook — using the fake credential that fails
 * locally at JWT signing (`importPKCS8`), so no network is involved.
 */

vi.mock('@/utilities/campaignActionContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/campaignActionContext')>()
  return { ...original, getCampaignActionContext: vi.fn(), reloadStaffActor: vi.fn() }
})

import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const mockedGetContext = vi.mocked(getCampaignActionContext)
const mockedReloadStaff = vi.mocked(reloadStaffActor)

const CALENDAR_ID = 'c_campanha_a@group.calendar.google.com'

describe('setGoogleCalendarSyncDisabled action (S18/D7)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  let ownedConfigId: number | null = null

  afterEach(async () => {
    if (ownedConfigId !== null) {
      // Scoped to OUR row: the C114 engine spec shares the test DB and its own
      // config lifecycle must not be robbed by this file's cleanup.
      await payload.delete({
        collection: 'googleCalendarSync',
        id: ownedConfigId,
        overrideAccess: true,
      })
      ownedConfigId = null
    }
    mockedGetContext.mockReset()
    mockedReloadStaff.mockReset()
  })

  /** The fixtures require a running test scope — create the actor per test. */
  const installStaffActor = async (): Promise<void> => {
    const actor = await campaignFixtures().createCampaignUser('coordinator')
    mockedGetContext.mockResolvedValue({ payload, actor })
    mockedReloadStaff.mockResolvedValue(actor)
  }

  const createConfig = async (overrides: Record<string, unknown> = {}) => {
    const doc = await payload.create({
      collection: 'googleCalendarSync',
      data: { calendarId: CALENDAR_ID, ...overrides },
      depth: 0,
      overrideAccess: true,
    })
    ownedConfigId = doc.id
    return doc
  }

  it('disable writes disabledAt and never runs the engine', async () => {
    await installStaffActor()
    await createConfig()

    const result: GoogleCalendarSyncActionResult = await withGoogleCalendarTestCredential(() =>
      setGoogleCalendarSyncDisabled(true),
    )

    expect(result.ok).toBe(true)
    expect(result.status).toBe('disabled')
    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.disabledAt).toBeTruthy()
    // Disabling must not trigger a pass: the state fields stay untouched.
    expect(doc?.lastSyncedAt).toBeNull()
    expect(doc?.lastErrorAt).toBeNull()
  })

  it('re-enable clears disabledAt and the config hook runs the reconciliation (D7)', async () => {
    await installStaffActor()
    await createConfig({ disabledAt: '2026-08-11T10:00:00.000Z' })

    const result: GoogleCalendarSyncActionResult = await withGoogleCalendarTestCredential(() =>
      setGoogleCalendarSyncDisabled(false),
    )

    expect(result.ok).toBe(true)
    const doc = await loadGoogleCalendarSyncConfig(payload)
    expect(doc?.disabledAt).toBeNull()
    // The fake credential fails locally (no network) — the paused outcome IS
    // the observable proof that the afterChange hook ran a sync pass.
    expect(doc?.lastErrorAt).toBeTruthy()
    expect(doc?.lastError).toBeTruthy()
    expect(result.status).toBe('paused')
  })

  it('no-op without a config doc keeps ok with the derived not-configured state', async () => {
    await installStaffActor()
    // Ensure no residual config doc from parallel specs (C114 shares the test DB).
    const stale = await payload.find({
      collection: 'googleCalendarSync',
      limit: 1,
      pagination: false,
      depth: 0,
      where: { calendarId: { exists: true } },
      overrideAccess: true,
    })
    if (stale.docs[0]) {
      await payload.delete({
        collection: 'googleCalendarSync',
        id: stale.docs[0].id,
        overrideAccess: true,
      })
    }

    const result: GoogleCalendarSyncActionResult = await withGoogleCalendarTestCredential(() =>
      setGoogleCalendarSyncDisabled(true),
    )

    expect(result.ok).toBe(true)
    expect(result.status).toBe('not-configured')
  })
})
