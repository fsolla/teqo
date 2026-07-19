import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loaders = vi.hoisted(() => ({
  getCampaignInviteConsentState: vi.fn(),
  getNucleusLeadershipPageData: vi.fn(),
  getSelectedNucleusLeadershipPageData: vi.fn(),
  getNucleusPrimaryContactPageData: vi.fn(),
  getNucleusUpdatesPreviewData: vi.fn(),
  getNucleusUpdatesPageData: vi.fn(),
  getNucleusElectoralBaseline: vi.fn(),
}))

vi.mock('@/utilities/campaignInvitePageData', () => ({
  getCampaignInviteConsentState: loaders.getCampaignInviteConsentState,
}))
vi.mock('@/utilities/leadershipPageData', () => ({
  getNucleusLeadershipPageData: loaders.getNucleusLeadershipPageData,
  getSelectedNucleusLeadershipPageData: loaders.getSelectedNucleusLeadershipPageData,
}))
vi.mock('@/utilities/primaryContactPageData', () => ({
  getNucleusPrimaryContactPageData: loaders.getNucleusPrimaryContactPageData,
}))
vi.mock('@/utilities/nucleusUpdatePageData', () => ({
  getNucleusUpdatesPreviewData: loaders.getNucleusUpdatesPreviewData,
  getNucleusUpdatesPageData: loaders.getNucleusUpdatesPageData,
}))
vi.mock('@/utilities/nucleusElectoralBaseline', () => ({
  getNucleusElectoralBaseline: loaders.getNucleusElectoralBaseline,
  toNucleusElectionGeographyInput: () => ({ cities: [], regions: [], tseZones: [] }),
}))

import { NucleusTabNav } from '@/components/campaign/NucleusTabNav'
import {
  buildNucleusDetailTabHref,
  getNucleusDetailTabRedirect,
  resolveNucleusDetailTab,
} from '@/utilities/nucleusDetailTabUi'
import { loadNucleusActiveTabPageData } from '@/utilities/nucleusDetailPageData'

describe('campaign nucleus URL-driven detail tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loaders.getCampaignInviteConsentState.mockResolvedValue({ configured: true })
    loaders.getNucleusLeadershipPageData.mockResolvedValue({
      kind: 'staff',
      leaderships: [],
      page: 1,
      totalDocs: 0,
      totalPages: 0,
    })
    loaders.getSelectedNucleusLeadershipPageData.mockResolvedValue({
      id: 31,
      contactId: 41,
      name: 'Maria',
      phone: '71999999999',
      email: null,
      gender: null,
      sector: null,
      sectorNotes: null,
      confirmedByPerson: false,
      supportStatus: 'engajado',
      notes: null,
      consentNote: null,
      hasAppAccess: false,
    })
    loaders.getNucleusPrimaryContactPageData.mockResolvedValue({ current: null, options: [] })
    loaders.getNucleusUpdatesPreviewData.mockResolvedValue([])
    loaders.getNucleusElectoralBaseline.mockResolvedValue(null)
    loaders.getNucleusUpdatesPageData.mockResolvedValue({
      updates: [],
      page: 1,
      totalDocs: 0,
      totalPages: 0,
    })
  })

  it('canonicalizes missing and invalid tabs while preserving common query state', () => {
    expect(resolveNucleusDetailTab({}, 'staff')).toBe('overview')
    expect(getNucleusDetailTabRedirect('nucleo-centro', { assignCoordinators: '1' }, 'staff')).toBe(
      '/campanha/nucleos/nucleo-centro?assignCoordinators=1&tab=overview',
    )
    expect(
      getNucleusDetailTabRedirect(
        'nucleo-centro',
        { tab: 'invalid', assignCoordinators: '1' },
        'staff',
      ),
    ).toBe('/campanha/nucleos/nucleo-centro?assignCoordinators=1&tab=overview')
    expect(getNucleusDetailTabRedirect('nucleo-centro', { tab: 'territory' }, 'staff')).toBeNull()
  })

  it('routes create flags to the tab that owns the requested dialog', () => {
    expect(resolveNucleusDetailTab({ tab: 'overview', newLeadership: '1' }, 'staff')).toBe(
      'leaderships',
    )
    expect(resolveNucleusDetailTab({ tab: 'overview', newUpdate: '1' }, 'staff')).toBe('updates')
    expect(
      getNucleusDetailTabRedirect(
        'nucleo-centro',
        { tab: 'overview', newLeadership: '1' },
        'staff',
      ),
    ).toBe('/campanha/nucleos/nucleo-centro?newLeadership=1&tab=leaderships')
    expect(
      getNucleusDetailTabRedirect('nucleo-centro', { tab: 'leaderships', newUpdate: '1' }, 'staff'),
    ).toBe('/campanha/nucleos/nucleo-centro?newUpdate=1&tab=updates')
  })

  it('rejects the staff-only electorate tab for leadership users', () => {
    expect(resolveNucleusDetailTab({ tab: 'electorate' }, 'leadership')).toBe('overview')
    expect(getNucleusDetailTabRedirect('nucleo-centro', { tab: 'electorate' }, 'leadership')).toBe(
      '/campanha/nucleos/nucleo-centro?tab=overview',
    )
  })

  it('builds direct links with only common and target-tab URL state', () => {
    const query = {
      tab: 'leaderships',
      assignCoordinators: '1',
      leadershipQ: 'Ana',
      leadershipPage: '2',
      updateKind: 'nota',
      updatePage: '3',
    }

    expect(buildNucleusDetailTabHref('nucleo-centro', 'leaderships', query)).toBe(
      '/campanha/nucleos/nucleo-centro?assignCoordinators=1&leadershipQ=Ana&leadershipPage=2&tab=leaderships',
    )
    expect(buildNucleusDetailTabHref('nucleo-centro', 'updates', query)).toBe(
      '/campanha/nucleos/nucleo-centro?assignCoordinators=1&updateKind=nota&updatePage=3&tab=updates',
    )
    expect(buildNucleusDetailTabHref('nucleo-centro', 'territory', query)).toBe(
      '/campanha/nucleos/nucleo-centro?assignCoordinators=1&tab=territory',
    )
  })

  it('round-trips every direct tab link for native back and forward navigation', () => {
    for (const tab of ['overview', 'territory', 'electorate', 'leaderships', 'updates'] as const) {
      const href = buildNucleusDetailTabHref('nucleo-centro', tab, {
        tab: 'overview',
        assignCoordinators: '1',
      })
      const query = Object.fromEntries(new URL(href, 'https://example.test').searchParams)

      expect(resolveNucleusDetailTab(query, 'staff')).toBe(tab)
      expect(getNucleusDetailTabRedirect('nucleo-centro', query, 'staff')).toBeNull()
    }

    const leadershipTabs = ['overview', 'territory', 'leaderships', 'updates'] as const
    for (const tab of leadershipTabs) {
      const href = buildNucleusDetailTabHref('nucleo-centro', tab, { tab: 'overview' })
      const query = Object.fromEntries(new URL(href, 'https://example.test').searchParams)
      expect(resolveNucleusDetailTab(query, 'leadership')).toBe(tab)
    }
  })

  it('renders semantic, focusable mobile-overflow navigation without tab-widget roles', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusTabNav, {
        activeTab: 'territory',
        nucleusKind: 'staff',
        nucleusSlug: 'nucleo-centro',
        searchParams: { tab: 'territory', assignCoordinators: '1' },
      }),
    )

    expect(html).toContain('<nav')
    expect(html).toContain('aria-label="Seções do núcleo"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('h-14')
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('overflow-y-hidden')
    expect(html).toContain('focus-visible:')
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('role="tab"')
    expect(html).toContain('?assignCoordinators=1&amp;tab=overview')
  })

  it('loads and returns only the active overview DTO', async () => {
    const result = await loadNucleusActiveTabPageData(
      {} as never,
      { id: 1, role: 'coordenador' } as never,
      { id: 2, slug: 'nucleo-centro', document: {} } as never,
      'overview',
      {},
    )

    expect(loaders.getNucleusUpdatesPreviewData).toHaveBeenCalledOnce()
    expect(loaders.getNucleusPrimaryContactPageData).toHaveBeenCalledOnce()
    expect(loaders.getNucleusElectoralBaseline).toHaveBeenCalledOnce()
    expect(loaders.getNucleusLeadershipPageData).not.toHaveBeenCalled()
    expect(loaders.getCampaignInviteConsentState).not.toHaveBeenCalled()
    expect(loaders.getNucleusUpdatesPageData).not.toHaveBeenCalled()
    expect(result).toEqual({
      tab: 'overview',
      primaryContactPageData: { current: null, options: [] },
      updatePreview: [],
      baseline: null,
    })
    expect(JSON.stringify(result)).not.toContain('leaderships')
    expect(JSON.stringify(result)).not.toContain('"updates"')
  })

  it('loads leadership and update data only for their active tab', async () => {
    const result = await loadNucleusActiveTabPageData(
      {} as never,
      { id: 1, role: 'coordenador' } as never,
      { id: 2, slug: 'nucleo-centro', document: {} } as never,
      'leaderships',
      { leadershipQ: 'Ana', leadership: '31' },
    )
    expect(loaders.getNucleusLeadershipPageData).toHaveBeenCalledOnce()
    expect(loaders.getSelectedNucleusLeadershipPageData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'coordenador' }),
      expect.objectContaining({ id: 2 }),
      31,
    )
    expect(loaders.getCampaignInviteConsentState).toHaveBeenCalledOnce()
    expect(loaders.getNucleusUpdatesPageData).not.toHaveBeenCalled()
    expect(loaders.getNucleusUpdatesPreviewData).not.toHaveBeenCalled()
    expect(loaders.getNucleusPrimaryContactPageData).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      panelState: { mode: 'view', leadershipId: 31 },
      selectedLeadership: { id: 31, name: 'Maria' },
    })
    expect(JSON.stringify(result.selectedLeadership)).not.toContain('password')

    vi.clearAllMocks()
    await loadNucleusActiveTabPageData(
      {} as never,
      { id: 1, role: 'coordenador' } as never,
      { id: 2, slug: 'nucleo-centro', document: {} } as never,
      'updates',
      { updateKind: 'nota' },
    )
    expect(loaders.getNucleusUpdatesPageData).toHaveBeenCalledOnce()
    expect(loaders.getNucleusLeadershipPageData).not.toHaveBeenCalled()
    expect(loaders.getCampaignInviteConsentState).not.toHaveBeenCalled()
    expect(loaders.getNucleusUpdatesPreviewData).not.toHaveBeenCalled()
    expect(loaders.getNucleusPrimaryContactPageData).not.toHaveBeenCalled()
  })

  it('does not resolve a selected record for leadership self view', async () => {
    const result = await loadNucleusActiveTabPageData(
      {} as never,
      { id: 8, role: 'lideranca' } as never,
      { id: 2, slug: 'nucleo-centro', document: {} } as never,
      'leaderships',
      { leadership: '31', editLeadership: '1' },
    )

    expect(loaders.getSelectedNucleusLeadershipPageData).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      panelState: { mode: 'closed' },
      selectedLeadership: null,
    })
  })

  it('executes no child loader for static territory and electorate tabs', async () => {
    for (const tab of ['territory', 'electorate'] as const) {
      await expect(
        loadNucleusActiveTabPageData(
          {} as never,
          { id: 1, role: 'coordenador' } as never,
          { id: 2, slug: 'nucleo-centro', document: {} } as never,
          tab,
          {},
        ),
      ).resolves.toEqual({ tab })
    }

    expect(loaders.getNucleusLeadershipPageData).not.toHaveBeenCalled()
    expect(loaders.getCampaignInviteConsentState).not.toHaveBeenCalled()
    expect(loaders.getNucleusUpdatesPageData).not.toHaveBeenCalled()
    expect(loaders.getNucleusUpdatesPreviewData).not.toHaveBeenCalled()
    expect(loaders.getNucleusPrimaryContactPageData).not.toHaveBeenCalled()
  })
})
