// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { loadFederalCandidateTotalsAggregated } from '@/utilities/federalCandidateTotalsAggregate'
import * as drizzleBulk from '@/utilities/drizzleBulk'
import type { PlazaElectionGeography } from '@/utilities/plazaElectionGeography'

describe('assertCanReadElectionData', () => {
  it('allows payload admins and campaign users to read election data', () => {
    expect(() =>
      assertCanReadElectionData({
        collection: 'users',
        id: 1,
      } as User),
    ).not.toThrow()

    expect(() =>
      assertCanReadElectionData({
        collection: 'campaignUser',
        id: 1,
        role: 'leader',
      } as unknown as CampaignUser),
    ).not.toThrow()
  })

  it('denies readers outside campaign/admin collections', () => {
    expect(() =>
      assertCanReadElectionData({
        collection: 'contact',
        id: 1,
      } as never),
    ).toThrow('Leitura de dados eleitorais negada.')
  })
})

describe('loadFederalCandidateTotalsAggregated', () => {
  it('maps drizzle aggregate rows and scopes geography in SQL', async () => {
    const geography: PlazaElectionGeography = {
      cityCode: '38490',
      zones: [1, 2],
    }

    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          candidate_number: 1313,
          candidate_name: 'JORGE SOLLA',
          party: 'PT',
          votes: 2100,
        },
        {
          candidate_number: 1234,
          candidate_name: 'OUTRO',
          party: 'PL',
          votes: 900,
        },
      ],
    })
    vi.spyOn(drizzleBulk, 'requirePostgresDrizzle').mockReturnValue({ execute })

    const payload = { db: { name: 'postgres' } } as Pick<Payload, 'db'>
    const totals = await loadFederalCandidateTotalsAggregated(
      payload,
      {
        collection: 'campaignUser',
        id: 1,
        role: 'coordinator',
      } as unknown as CampaignUser,
      geography,
    )

    expect(totals).toEqual([
      { candidateNumber: 1313, name: 'JORGE SOLLA', party: 'PT', votes: 2100 },
      { candidateNumber: 1234, name: 'OUTRO', party: 'PL', votes: 900 },
    ])
    expect(execute).toHaveBeenCalledOnce()
    const sqlPayload = JSON.stringify(execute.mock.calls[0]?.[0])
    expect(sqlPayload).toContain('city_code')
    expect(sqlPayload).not.toContain('city_name')
    vi.restoreAllMocks()
  })
})
