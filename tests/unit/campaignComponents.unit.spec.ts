import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { MunicipalityList } from '@/components/campaign/MunicipalityList'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { Progress } from '@/components/ui/Progress'
import { Toggle } from '@/components/ui/Toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { MunicipalityAdvisorSummary, MunicipalityListViewModel } from '@/utilities/municipalityViewModels'
import { toVoteEstimateScenarioViewModel } from '@/utilities/voteEstimate'
import { createEmptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeData'

const noopListFormAction = async (
  _state: CampaignFormActionState,
  _formData: FormData,
): Promise<CampaignFormActionState> => ({})

const municipalityListDefaultProps = {
  isCoordinator: false,
  advisorOptions: [],
  trendFormAction: noopListFormAction,
  advisorsFormAction: noopListFormAction,
}

describe('campaign visual foundation', () => {
  it('exposes the current progress value to assistive technology', () => {
    const html = renderToStaticMarkup(createElement(Progress, { value: 42 }))

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="42"')
  })

  it.each(['sm', 'default', 'lg'] as const)(
    'keeps the %s toggle at least 44 by 44 pixels',
    (size) => {
      const html = renderToStaticMarkup(createElement(Toggle, { size }, 'Filtro'))

      expect(html).toContain('min-h-11')
      expect(html).toContain('min-w-11')
    },
  )

  it('keeps toggle group items at least 44 by 44 pixels', () => {
    const html = renderToStaticMarkup(
      createElement(
        ToggleGroup,
        { type: 'single' },
        createElement(ToggleGroupItem, { value: 'engajado' }, 'Engajado'),
      ),
    )

    expect(html).toContain('data-slot="toggle-group-item"')
    expect(html).toContain('min-h-11')
    expect(html).toContain('min-w-11')
  })

  it('renders campaign scope with a visible, accessible label', () => {
    const html = renderToStaticMarkup(
      createElement(CampaignScopeBadge, null, '3 Praças sob sua assessoria'),
    )

    expect(html).toContain('3 Praças sob sua assessoria')
    expect(html).toContain('data-scope="campaign"')
  })

  it('keeps the authenticated shell fixed while its content pane scrolls', () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), 'src/app/(campaign)/campanha/(app)/layout.tsx'),
      'utf8',
    )
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/CampaignSidebar.tsx'),
      'utf8',
    )

    expect(layoutSource).toContain('className="h-svh min-h-0 overflow-hidden"')
    expect(layoutSource).toContain('data-slot="campaign-content-scroll"')
    expect(layoutSource).toContain('min-h-0 flex-1 overflow-y-auto overscroll-contain')
    expect(sidebarSource).toContain('h-svh shrink-0')
  })

  it('uses light sidebar tokens and readable logout states', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/CampaignSidebar.tsx'),
      'utf8',
    )

    expect(styles).toContain('--sidebar: #fafaf9')
    expect(styles).toContain('--sidebar-foreground: #1c1917')
    expect(styles).toContain('--sidebar-accent-foreground: #1c1917')
    expect(sidebarSource).toContain('text-sidebar-foreground')
    expect(sidebarSource).toContain('hover:text-sidebar-accent-foreground')
  })

  it.each([
    ['engajado', 'Engajado'],
    ['a_abordar', 'A abordar'],
    ['em_disputa', 'Em disputa'],
    ['negativo', 'Negativo'],
  ] as const)('renders the %s support status with text and semantic state', (status, label) => {
    const html = renderToStaticMarkup(createElement(SupportStatusBadge, { status }))

    expect(html).toContain(label)
    expect(html).toContain(`data-support-status="${status}"`)
  })

  it('qualifies TSE zones instead of showing an ambiguous number', () => {
    const html = renderToStaticMarkup(createElement(TseZoneBadge, { zoneNumber: 12 }))

    expect(html).toContain('ZE 12')
    expect(html).toContain('aria-label="Zona Eleitoral TSE 12"')
  })

  it('renders municipality rows with geography, pledges, and advisor coverage for staff', () => {
    const advisor: MunicipalityAdvisorSummary = { id: 7, name: 'Ana Bastos', phone: null }
    const municipalities: MunicipalityListViewModel[] = [
      {
        id: 1,
        name: 'Seabra',
        slug: 'seabra',
        kind: 'municipio',
        city: 'Seabra',
        region: 'Chapada Diamantina',
        ibgeCode: '2929800',
        zoneNumber: null,
        advisorIDs: [advisor.id],
        priority: 'alta',
        lastUpdateAt: null,
        expectedVotes: { pessimistic: null, central: 1500, optimistic: null },
        politicalTrendStatus: 'favoravel',
        politicalTrendNote: null,
        pledges: {
          declaredTotal: 1200,
          effectiveByScenario: { pessimistic: 1200, central: 1200, optimistic: 1200 },
          pledgeCount: 2,
          missingEstimateCount: 1,
        },
      },
      {
        id: 2,
        name: 'Salvador — ZE 3',
        slug: 'salvador-ze-3',
        kind: 'zona',
        city: 'Salvador',
        region: 'Metropolitano de Salvador',
        ibgeCode: '2927408',
        zoneNumber: 3,
        advisorIDs: [],
        priority: 'normal',
        lastUpdateAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
        pledges: createEmptyMunicipalityPledgeAggregate(),
      },
    ]

    const html = renderToStaticMarkup(
      createElement(MunicipalityList, {
        municipalities,
        advisorNamesById: new Map([[advisor.id, advisor]]),
        isStaffView: true,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).toContain('Chapada Diamantina')
    expect(html).toContain('href="/campanha/municipios/seabra"')
    expect(html).toContain('1.500')
    expect(html).toContain('Cenários de estimativa')
    expect(html).toContain('Prioritária')
    expect(html).toContain('Coberta')
    expect(html).toContain('Sem assessor')
    expect(html).toContain('Tendência')
  })

  it('hides leadership coverage subline when pledges only have declared votes', () => {
    const html = renderToStaticMarkup(
      createElement(MunicipalityList, {
        municipalities: [
          {
            id: 3,
            name: 'Itaberaba',
            slug: 'itaberaba',
            kind: 'municipio',
            city: 'Itaberaba',
            region: 'Centro Norte',
            ibgeCode: '2914703',
            zoneNumber: null,
            advisorIDs: [],
            priority: 'normal',
            lastUpdateAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            pledges: {
              declaredTotal: 800,
              effectiveByScenario: { pessimistic: 800, central: 800, optimistic: 800 },
              pledgeCount: 1,
              missingEstimateCount: 1,
            },
          },
        ],
        advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
        isStaffView: true,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Itaberaba')
    expect(html).not.toContain('>Nas lideranças')
    expect(html).not.toContain('Declarado nas lideranças')
  })

  it('hides staff-only pledge and coverage columns from the leader view', () => {
    const html = renderToStaticMarkup(
      createElement(MunicipalityList, {
        municipalities: [
          {
            id: 1,
            name: 'Seabra',
            slug: 'seabra',
            kind: 'municipio',
            city: 'Seabra',
            region: 'Chapada Diamantina',
            ibgeCode: '2929800',
            zoneNumber: null,
            advisorIDs: [],
            priority: 'alta',
            lastUpdateAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            pledges: createEmptyMunicipalityPledgeAggregate(),
          },
        ],
        advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
        isStaffView: false,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).not.toContain('Votos estimados')
    expect(html).not.toContain('Cobertura')
    expect(html).not.toContain('Prioritária')
  })
})
