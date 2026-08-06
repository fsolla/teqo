/**
 * B161 — the incremental-load wire contract: query-string round-trip helpers
 * and the fail-closed gates every `fetchNextXListPage` action shares (no
 * session, non-staff role, out-of-range page) — all before any database work.
 */
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}))

vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: mocks.getUser,
}))

import { fetchNextDemandListPage } from '@/app/(campaign)/campanha/actions/demand'
import {
  CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
  CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE,
} from '@/lib/campaignListPage'
import { queryFromCanonicalHref, rawSearchParamsFromQueryString } from '@/utilities/campaignListUrl'

describe('queryFromCanonicalHref', () => {
  it('drops the path and keeps the query', () => {
    expect(queryFromCanonicalHref('/campanha/demandas?status=aberta&kind=material')).toBe(
      'status=aberta&kind=material',
    )
  })

  it('answers an empty signature for filter-less lists', () => {
    expect(queryFromCanonicalHref('/campanha/demandas')).toBe('')
  })
})

describe('rawSearchParamsFromQueryString', () => {
  it('round-trips single and repeated params through the list parsers', () => {
    expect(rawSearchParamsFromQueryString('q=ana&status=aberta&status=escalada')).toEqual({
      q: 'ana',
      status: ['aberta', 'escalada'],
    })
    expect(rawSearchParamsFromQueryString('')).toEqual({})
  })
})

describe('fetchNextDemandListPage fail-closed gates', () => {
  it('rejects page 1 and non-integer pages without touching the session', async () => {
    await expect(fetchNextDemandListPage('', 1)).resolves.toEqual({
      status: 'error',
      message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
    })
    await expect(fetchNextDemandListPage('', 0)).resolves.toEqual({
      status: 'error',
      message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
    })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('answers the session-expired message when there is no campaign user', async () => {
    mocks.getUser.mockResolvedValueOnce(null)
    await expect(fetchNextDemandListPage('status=aberta', 2)).resolves.toEqual({
      status: 'error',
      message: CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE,
    })
  })

  it('refuses non-staff roles (the list surface is gate: staff)', async () => {
    mocks.getUser.mockResolvedValueOnce({ id: 1, role: 'leader' })
    await expect(fetchNextDemandListPage('status=aberta', 2)).resolves.toEqual({
      status: 'error',
      message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
    })
  })
})
