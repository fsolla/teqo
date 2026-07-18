import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCampaignUser: vi.fn(),
  getPayload: vi.fn(),
  loadNucleusListPageData: vi.fn(),
  loadNucleusListOverviewData: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`)
  }),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/utilities/campaignAuth', () => ({
  getCampaignUser: mocks.getCampaignUser,
}))
vi.mock('@/utilities/nucleusPageData', () => ({
  loadNucleusListPageData: mocks.loadNucleusListPageData,
}))
vi.mock('@/utilities/nucleusListOverviewPageData', () => ({
  loadNucleusListOverviewData: mocks.loadNucleusListOverviewData,
}))

import NucleiPage from '@/app/(campaign)/campanha/(app)/nucleos/page'

describe('campaign nucleus server page canonical URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCampaignUser.mockResolvedValue({ id: 9, role: 'coordenador' })
    mocks.getPayload.mockResolvedValue({})
    mocks.loadNucleusListOverviewData.mockResolvedValue(null)
  })

  it('redirects a noncanonical query before loading Payload data', async () => {
    await expect(
      NucleiPage({
        searchParams: Promise.resolve({
          city: 'mucuge',
          region: 'CHAPADA DIAMANTINA',
          obsoleteFilter: 'legacy',
        }),
      }),
    ).rejects.toThrow('redirect:/campanha/nucleos?region=Chapada+Diamantina&city=Mucug%C3%AA')

    expect(mocks.getCampaignUser).not.toHaveBeenCalled()
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.loadNucleusListPageData).not.toHaveBeenCalled()
  })

  it('routes out-of-range pagination through the canonical resolver', async () => {
    mocks.loadNucleusListPageData.mockResolvedValue({
      result: { docs: [], totalDocs: 0, totalPages: 3 },
      scope: { totalDocs: 0 },
      state: { page: 9, q: 'Chapada' },
    })

    await expect(
      NucleiPage({
        searchParams: Promise.resolve({ q: 'Chapada', page: '9' }),
      }),
    ).rejects.toThrow('redirect:/campanha/nucleos?q=Chapada&page=3')

    expect(mocks.loadNucleusListPageData).toHaveBeenCalledOnce()
  })
})
