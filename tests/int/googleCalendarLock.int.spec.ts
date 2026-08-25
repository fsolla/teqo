// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { loadGoogleCalendarSyncConfig } from '@/utilities/googleCalendarSync'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import {
  createSlowGoogleFetch,
  withValidGoogleCalendarCredential,
} from '../helpers/googleCalendarTestKey'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('C114-LOCK — hooks do not hold row lock for network I/O', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  const ownedConfigIds = new Set<number>()

  afterEach(async () => {
    await payload.delete({
      collection: 'activity',
      where: { title: { like: 'C114-LOCK%' } },
      overrideAccess: true,
    })
    for (const id of ownedConfigIds) {
      await payload.delete({ collection: 'googleCalendarSync', id, overrideAccess: true })
    }
    ownedConfigIds.clear()
    vi.unstubAllGlobals()
  })

  it('activity afterChange does not hold the row lock for the full per-hop budget (hook aborts ~5s)', async () => {
    await withValidGoogleCalendarCredential(async () => {
      const municipality = await campaignFixtures().getMunicipality()

      const configDoc = await payload.create({
        collection: 'googleCalendarSync',
        data: { calendarId: 'c_lock_test@group.calendar.google.com' },
        depth: 0,
        overrideAccess: true,
      })
      ownedConfigIds.add(configDoc.id)

      vi.stubGlobal('fetch', createSlowGoogleFetch(10_000))

      const start = Date.now()
      const activity = await payload.create({
        collection: 'activity',
        data: hookFilledCreateData<'activity'>({
          title: `C114-LOCK ${Date.now()}`,
          tags: ['Caminhada'],
          status: 'confirmado',
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          municipality: municipality.id,
        }),
        depth: 0,
        overrideAccess: true,
      })
      const elapsed = Date.now() - start

      // The create must NOT be held for the full per-hop 15s budget × N.
      // Hook budget is 5s, so we allow ~7s headroom for DB + catch.
      expect(elapsed).toBeLessThan(7_000)
      expect(activity.title).toContain('C114-LOCK')

      // The engine caught the abort and recorded paused (fail-closed).
      const doc = await loadGoogleCalendarSyncConfig(payload)
      expect(doc?.lastErrorAt).toBeTruthy()
      // The error message comes from the AbortError caught in runCampaignCalendarSync
      // and is sliced to 500 chars — content is not strictly asserted, only presence.
      expect(doc?.lastError).toBeTruthy()
    })
  })

  it('googleCalendarSync afterChange (config change) also respects the hook budget', async () => {
    await withValidGoogleCalendarCredential(async () => {
      const municipality = await campaignFixtures().getMunicipality()

      const configDoc = await payload.create({
        collection: 'googleCalendarSync',
        data: { calendarId: 'c_lock_a@group.calendar.google.com' },
        depth: 0,
        overrideAccess: true,
      })
      ownedConfigIds.add(configDoc.id)

      // One activity so the engine has work to do after the config change.
      await payload.create({
        collection: 'activity',
        data: hookFilledCreateData<'activity'>({
          title: `C114-LOCK ${Date.now()}`,
          tags: ['Caminhada'],
          status: 'confirmado',
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          municipality: municipality.id,
        }),
        depth: 0,
        overrideAccess: true,
      })

      vi.stubGlobal('fetch', createSlowGoogleFetch(10_000))

      const start = Date.now()
      // Changing calendarId triggers googleCalendarSyncConfigHook → engine
      await payload.update({
        collection: 'googleCalendarSync',
        id: configDoc.id,
        data: { calendarId: 'c_lock_b@group.calendar.google.com' },
        depth: 0,
        overrideAccess: true,
      })
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(7_000)

      const doc = await loadGoogleCalendarSyncConfig(payload)
      expect(doc?.lastErrorAt).toBeTruthy()
      expect(doc?.lastError).toBeTruthy()
    })
  })
})
