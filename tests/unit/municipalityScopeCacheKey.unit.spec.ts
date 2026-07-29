// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  request: 1,
  find: vi.fn(),
}))

// React `cache()` keyed on ALL arguments, so a call whose extraSelect differs
// must miss the base call's entry (P3-E pin: cache-key separation).
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>()
  const requestCaches = new Map<number, Map<string, unknown>>()

  return {
    ...original,
    cache:
      <Args extends unknown[], Result>(callback: (...args: Args) => Result) =>
      (...args: Args): Result => {
        const requestCache = requestCaches.get(state.request) ?? new Map<string, unknown>()
        requestCaches.set(state.request, requestCache)
        // Top-level only: a nested replacer would see the args ARRAY itself
        // (an object) first and collapse every call to the same key.
        const key = JSON.stringify(
          args.map((arg) => (typeof arg === 'object' && arg !== null ? '<arg>' : arg)),
        )
        if (!requestCache.has(key)) requestCache.set(key, callback(...args))
        return requestCache.get(key) as Result
      },
  }
})

import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'

import { stub } from '../helpers/stub'

const coordinator = stub<CampaignUser>({ collection: 'campaignUser', id: 1, role: 'coordinator' })

const stubPayload = (): Payload => {
  state.find.mockReset()
  state.find.mockResolvedValue({ docs: [] })
  return stub<Payload>({ find: state.find })
}

describe('municipality scope cache key (P3-E)', () => {
  beforeEach(() => {
    state.request += 1
  })

  it('does not share a cache entry between base and extraSelect calls', async () => {
    const payload = stubPayload()

    await loadMunicipalityScope(payload, coordinator, {})
    await loadMunicipalityScope(
      payload,
      coordinator,
      {},
      {
        extraSelect: { engagementLevel: true, lastUpdateAt: true },
      },
    )

    const selects = state.find.mock.calls
      .map(([args]) => args as { collection: string; select?: Record<string, true> })
      .filter((args) => args.collection === 'municipality')
      .map((args) => args.select)

    expect(selects).toHaveLength(2)
    expect(selects[0]).not.toHaveProperty('engagementLevel')
    expect(selects[1]).toMatchObject({ engagementLevel: true, lastUpdateAt: true })
  })

  it('shares the cache entry for identical calls within one request', async () => {
    const payload = stubPayload()

    await loadMunicipalityScope(payload, coordinator, {})
    await loadMunicipalityScope(payload, coordinator, {})

    const municipalityReads = state.find.mock.calls.filter(
      ([args]) => (args as { collection: string }).collection === 'municipality',
    )
    expect(municipalityReads).toHaveLength(1)
  })
})
