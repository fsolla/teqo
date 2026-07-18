import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCampaignUser: vi.fn(),
  getPayload: vi.fn(),
  resolveAccessibleNucleusContext: vi.fn(),
  getNucleusDetailPageData: vi.fn(),
  getNucleusCoordinatorAssignmentPageData: vi.fn(),
  getNucleusLeadershipPageData: vi.fn(),
  getNucleusUpdatesPageData: vi.fn(),
  getNucleusPrimaryContactPageData: vi.fn(),
  getCampaignInviteConsentState: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
  NucleusNotFoundError: class NucleusNotFoundError extends Error {},
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: vi.fn(),
}))
vi.mock('@/utilities/campaignAuth', () => ({ getCampaignUser: mocks.getCampaignUser }))
vi.mock('@/utilities/campaignInvitePageData', () => ({
  getCampaignInviteConsentState: mocks.getCampaignInviteConsentState,
}))
vi.mock('@/utilities/nucleusPageData', () => ({
  getNucleusDetailPageData: mocks.getNucleusDetailPageData,
  resolveAccessibleNucleusContext: mocks.resolveAccessibleNucleusContext,
  NucleusNotFoundError: mocks.NucleusNotFoundError,
}))
vi.mock('@/utilities/nucleusDetailPageData', () => ({
  loadNucleusDetailPageData: async (
    payload: unknown,
    user: unknown,
    slug: string,
    activeTab: unknown,
  ) => {
    const context = await mocks.resolveAccessibleNucleusContext(payload, user, slug, activeTab)
    const coordinatorAssignment = await mocks.getNucleusCoordinatorAssignmentPageData(
      payload,
      user,
      context,
    )
    return {
      context,
      view: mocks.getNucleusDetailPageData(context, user),
      coordinatorAssignment,
    }
  },
}))
vi.mock('@/utilities/nucleusCoordinatorAssignmentPageData', () => ({
  getNucleusCoordinatorAssignmentPageData: mocks.getNucleusCoordinatorAssignmentPageData,
}))
vi.mock('@/utilities/leadershipPageData', () => ({
  getNucleusLeadershipPageData: mocks.getNucleusLeadershipPageData,
}))
vi.mock('@/utilities/nucleusUpdatePageData', () => ({
  getNucleusUpdatesPageData: mocks.getNucleusUpdatesPageData,
}))
vi.mock('@/utilities/primaryContactPageData', () => ({
  getNucleusPrimaryContactPageData: mocks.getNucleusPrimaryContactPageData,
}))
vi.mock('@/utilities/leadershipUi', () => ({
  buildLeadershipPanelHref: vi.fn(() => '/campanha/nucleos/nucleo-centro?tab=leaderships'),
  buildLeadershipFilterHref: vi.fn(),
  nucleusDetailFocusFallbackId: 'nucleus-detail-heading',
  parseLeadershipFilterState: vi.fn(() => ({ page: 1 })),
}))
vi.mock('@/utilities/nucleusUpdateUi', () => ({
  buildNucleusUpdateHref: vi.fn(),
  parseNucleusUpdateListState: vi.fn(() => ({ page: 1 })),
}))
vi.mock('@/utilities/nucleusUi', () => ({
  organizationKindLabels: { territorial: 'Territorial' },
}))
vi.mock('@/utilities/phone', () => ({ buildWhatsAppUrl: vi.fn() }))
vi.mock('@/app/(campaign)/campanha/(app)/nucleos/[slug]/coordinatorAssignmentFormActions', () => ({
  assignNucleusCoordinatorsFormAction: vi.fn(),
}))
vi.mock('@/app/(campaign)/campanha/(app)/nucleos/[slug]/voteEstimateFormActions', () => ({
  confirmVoteEstimateFormAction: vi.fn(),
}))
vi.mock('@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusUpdateFormActions', () => ({
  createNucleusUpdateFormAction: vi.fn(),
}))
vi.mock('@/components/campaign/CoordinatorAssignmentCard', () => ({
  CoordinatorAssignmentCard: () =>
    createElement('article', { 'data-testid': 'coordinator-assignment-card' }),
}))
vi.mock('@/components/campaign/VoteEstimateCard', () => ({
  VoteEstimateCard: () => createElement('article', { 'data-testid': 'vote-estimate-card' }),
}))
vi.mock('@/components/campaign/NucleusActiveTab', () => ({
  NucleusActiveTab: () => createElement('div', { 'data-testid': 'nucleus-active-tab' }),
  NucleusActiveTabLoading: () => createElement('div', { 'data-testid': 'nucleus-tab-loading' }),
}))
vi.mock('@/components/campaign/NucleusTabNav', () => ({
  NucleusTabNav: () => createElement('nav', { 'data-testid': 'nucleus-tab-nav' }),
}))
vi.mock('@/components/campaign/CampaignScopeBadge', () => ({
  CampaignScopeBadge: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('@/components/campaign/TseZoneBadge', () => ({
  TseZoneBadge: () => createElement('span'),
}))
vi.mock('@/components/campaign/ArchiveNucleusDialog', () => ({
  ArchiveNucleusDialog: () => null,
}))
vi.mock('@/components/campaign/VoteEstimateDialog', () => ({
  VoteEstimateDialog: () => null,
}))
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => createElement('span', null, children),
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import NucleusDetailPage from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/page'

describe('campaign nucleus summary layout', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCampaignUser.mockResolvedValue({ id: 9, role: 'coordenador' })
    mocks.getPayload.mockResolvedValue({})
    mocks.resolveAccessibleNucleusContext.mockResolvedValue({
      id: 1,
      slug: 'nucleo-centro',
      document: {},
    })
    mocks.getNucleusDetailPageData.mockReturnValue({
      kind: 'staff',
      id: 1,
      slug: 'nucleo-centro',
      name: 'Núcleo Centro',
      status: 'ativo',
      organizationKind: 'territorial',
      organizationLabel: null,
      neighborhood: null,
      locality: null,
      city: 'Salvador',
      region: 'Metropolitano de Salvador',
      tseZones: [],
      confirmedVoteEstimate: null,
      proposedVoteEstimate: null,
      proposedVoteEstimateVersion: null,
      primaryContactId: null,
      tabs: {},
    })
    mocks.getNucleusCoordinatorAssignmentPageData.mockResolvedValue({
      canManage: false,
      coordinators: [],
    })
    mocks.getNucleusLeadershipPageData.mockResolvedValue({
      kind: 'staff',
      leaderships: [],
      totalPages: 0,
    })
    mocks.getNucleusUpdatesPageData.mockResolvedValue({ totalPages: 0 })
    mocks.getNucleusPrimaryContactPageData.mockResolvedValue({ current: null, options: [] })
    mocks.getCampaignInviteConsentState.mockResolvedValue({ configured: true })
  })

  it('renders the two summary cards in logical order before the tab navigation', async () => {
    render(
      await NucleusDetailPage({
        params: Promise.resolve({ slug: 'nucleo-centro' }),
        searchParams: Promise.resolve({}),
      }),
    )

    const summary = screen.getByRole('region', { name: 'Resumo operacional' })
    const directCards = Array.from(summary.children)

    expect(directCards).toHaveLength(2)
    expect(directCards[0]).toBe(screen.getByTestId('coordinator-assignment-card'))
    expect(directCards[1]).toBe(screen.getByTestId('vote-estimate-card'))

    const tabNav = screen.getByTestId('nucleus-tab-nav')
    expect(within(summary).queryByTestId('nucleus-tab-nav')).toBeNull()
    expect(summary.nextElementSibling).toBe(tabNav)
    expect(tabNav.nextElementSibling).toBe(screen.getByTestId('nucleus-active-tab'))
  })

  it('keeps the responsive summary grid and child sizing constraints', async () => {
    render(
      await NucleusDetailPage({
        params: Promise.resolve({ slug: 'nucleo-centro' }),
        searchParams: Promise.resolve({}),
      }),
    )

    const summary = screen.getByRole('region', { name: 'Resumo operacional' })

    expect(summary.classList).toContain('grid')
    expect(summary.classList).toContain('grid-cols-1')
    expect(summary.classList).toContain('lg:grid-cols-2')
    expect(summary.classList).toContain('items-stretch')
    expect(summary.classList).toContain('min-w-0')
    expect(summary.classList).toContain('*:min-w-0')
  })

  it('maps only typed inaccessible nucleus failures to not-found', async () => {
    mocks.resolveAccessibleNucleusContext.mockRejectedValue(new mocks.NucleusNotFoundError())

    await expect(
      NucleusDetailPage({
        params: Promise.resolve({ slug: 'nucleo-inacessivel' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('not-found')

    expect(mocks.notFound).toHaveBeenCalledOnce()
    expect(mocks.getNucleusLeadershipPageData).not.toHaveBeenCalled()
  })

  it('propagates resolver and child loader failures to the route error boundary', async () => {
    const databaseError = new Error('database unavailable')
    mocks.resolveAccessibleNucleusContext.mockRejectedValueOnce(databaseError)

    await expect(
      NucleusDetailPage({
        params: Promise.resolve({ slug: 'nucleo-centro' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(databaseError)
    expect(mocks.notFound).not.toHaveBeenCalled()

    mocks.resolveAccessibleNucleusContext.mockResolvedValue({
      id: 1,
      slug: 'nucleo-centro',
      document: {},
    })
    mocks.getNucleusCoordinatorAssignmentPageData.mockRejectedValueOnce(databaseError)

    await expect(
      NucleusDetailPage({
        params: Promise.resolve({ slug: 'nucleo-centro' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(databaseError)
    expect(mocks.notFound).not.toHaveBeenCalled()
  })
})
