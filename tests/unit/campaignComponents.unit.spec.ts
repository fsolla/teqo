import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { formatAdvisorNamesTooltip } from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import {
  MunicipalityList,
  municipalityListPickerColumns,
} from '@/components/campaign/municipality/MunicipalityList'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { TseZoneBadge } from '@/components/campaign/municipality/TseZoneBadge'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { Progress } from '@/components/ui/Progress'
import { Toggle } from '@/components/ui/Toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { CampaignColumnVisibility } from '@/lib/campaignColumnVisibility'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import { createEmptyGoalCoverageByScenario } from '@/utilities/municipality/goalCoverage'
import { municipalityPriorityIndicatorLabel } from '@/utilities/municipality/municipalityLabels'
import type {
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import { createEmptyMunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

import { stub } from '../helpers/stub'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

const noopListFormAction = async (
  _state: CampaignFormActionState,
  _formData: FormData,
): Promise<CampaignFormActionState> => ({})

const municipalityListDefaultProps = {
  isCoordinator: false,
  isCampaignUnrestricted: false,
  columnVisibility: {
    listId: 'municipios',
    hiddenColumnIds: [],
  } satisfies CampaignColumnVisibility,
  canMoveEngagementLevel: false,
  advisorOptions: [],
  leadershipNamesById: new Map(),
  leadershipOptions: [],
  stateDeputyOptions: [],
  stateDeputyCommitAction: noopListFormAction,
  stateDeputyCreateAction: async () => ({}),
  columnFilterOptions: { name: [], region: [], advisor: [] },
  signalFormAction: noopListFormAction,
  state: { page: 1 },
}

const responsiveMunicipality = stub<MunicipalityListViewModel>({
  id: 1,
  name: 'São Francisco do Conde com nome extenso',
  slug: 'sao-francisco-do-conde',
  kind: 'municipio',
  city: 'São Francisco do Conde',
  region: 'Metropolitano de Salvador',
  ibgeCode: '2929206',
  zoneNumber: null,
  advisorIDs: [],
  leadershipIDs: [],
  stateDeputyIDs: [],
  priority: 'normal',
  lastUpdateAt: null,
  lastSignalAt: null,
  expectedVotes: toVoteEstimateScenarioViewModel(null),
  politicalTrendStatus: null,
  politicalTrendNote: null,
  engagementLevel: null,
  levelNote: null,
  levelChangedAt: null,
  pledges: createEmptyMunicipalityPledgeAggregate(),
  votePosition2022: null,
  territorialClass: 'sem_base',
  territorialClassFactors: [],
  goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
})

const mockAppRouter = stub<Parameters<typeof AppRouterContext.Provider>[0]['value']>({
  push: () => {},
  replace: () => {},
  refresh: () => {},
  forward: () => {},
  back: () => {},
  prefetch: () => Promise.resolve(),
})

// Cells render `CampaignHoverTooltip` (Radix), which refuses to render outside
// a provider; production mounts it in the `(app)` layout.
const renderWithTooltip = (element: React.ReactElement) =>
  renderToStaticMarkup(createElement(TooltipProvider, null, element))

const renderWithAppRouter = (element: React.ReactElement) =>
  renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: mockAppRouter },
      createElement(TooltipProvider, null, element),
    ),
  )

describe('campaign visual foundation', () => {
  it('exposes the current progress value to assistive technology', () => {
    const html = renderToStaticMarkup(createElement(Progress, { value: 42 }))

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="42"')
  })

  it.each(['sm', 'default', 'lg'] as const)('renders the %s toggle with a button role', (size) => {
    const html = renderToStaticMarkup(createElement(Toggle, { size }, 'Filtro'))

    expect(html).toContain('type="button"')
    expect(html).toContain('Filtro')
  })

  it('renders toggle group items with the shared slot contract', () => {
    const html = renderToStaticMarkup(
      createElement(
        ToggleGroup,
        { type: 'single' },
        createElement(ToggleGroupItem, { value: 'engajado' }, 'Engajado'),
      ),
    )

    expect(html).toContain('data-slot="toggle-group-item"')
    expect(html).toContain('Engajado')
  })

  it('renders campaign scope with a visible, accessible label', () => {
    const html = renderToStaticMarkup(
      createElement(CampaignScopeBadge, null, '3 municípios sob sua assessoria'),
    )

    expect(html).toContain('3 municípios sob sua assessoria')
    expect(html).toContain('data-scope="campaign"')
  })

  it('keeps the authenticated shell fixed while its content pane scrolls', () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), 'src/app/(campaign)/campanha/(app)/layout.tsx'),
      'utf8',
    )
    const scrollChromeSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/shell/CampaignQuickActionsHost.tsx'),
      'utf8',
    )
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/shell/CampaignSidebar.tsx'),
      'utf8',
    )

    expect(layoutSource).toContain('CampaignAppScrollChrome')
    expect(scrollChromeSource).toContain('data-slot="campaign-content-scroll"')
    expect(sidebarSource).toContain('collapsible="offcanvas"')
    expect(sidebarSource).toContain('print:hidden')
  })

  it('uses sidebar semantic tokens and readable logout states', () => {
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/shell/CampaignSidebar.tsx'),
      'utf8',
    )

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
        leadershipIDs: [11],
        stateDeputyIDs: [],
        priority: 'alta',
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: { pessimistic: null, central: 1500, optimistic: null },
        politicalTrendStatus: 'favoravel',
        politicalTrendNote: null,
        engagementLevel: null,
        levelNote: null,
        levelChangedAt: null,
        pledges: {
          declaredTotal: 1200,
          effectiveByScenario: { pessimistic: 1200, central: 1200, optimistic: 1200 },
          pledgeCount: 2,
          missingEstimateCount: 1,
          lastPledgeAt: null,
        },
        votePosition2022: {
          votes: 4200,
          rank: 12,
          share: 0.031,
          totalUnits: 435,
        },
        territorialClass: 'reduto',
        territorialClassFactors: [
          { id: 'dominance', value: 2.4 },
          { id: 'ownShare', value: 0.031 },
        ],
        goalCoverageByScenario: {
          pessimistic: { goal: 1500, committed: 1200, coverageRatio: 0.8, deficit: 300 },
          central: { goal: 1500, committed: 1200, coverageRatio: 0.8, deficit: 300 },
          optimistic: { goal: 1500, committed: 1200, coverageRatio: 0.8, deficit: 300 },
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
        leadershipIDs: [],
        stateDeputyIDs: [],
        priority: 'normal',
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
        engagementLevel: null,
        levelNote: null,
        levelChangedAt: null,
        pledges: createEmptyMunicipalityPledgeAggregate(),
        votePosition2022: null,
        territorialClass: 'expansao',
        territorialClassFactors: [{ id: 'field', value: 9000 }],
        goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
      },
    ]

    const html = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities,
        advisorNamesById: new Map([[advisor.id, advisor]]),
        isStaffView: true,
        ...municipalityListDefaultProps,
        leadershipNamesById: new Map([[11, { id: 11, name: 'Maria de Jesus' }]]),
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).toContain('Chapada Diamantina')
    expect(html).toContain('href="/campanha/territorios#ti-chapada-diamantina"')
    expect(html).toContain('href="/campanha/municipios/seabra"')
    expect(html).toContain('1.500')
    expect(html).toContain('Cenários de estimativa')
    expect(html).toContain(`aria-label="${municipalityPriorityIndicatorLabel}"`)
    expect(html).toContain('lucide-flag')
    expect(html).not.toMatch(/>\s*Prioritária\s*<\/span>/)
    // The advisor column carries coverage on its own — no separate "Assessoria" column.
    expect(html).toContain('Assessores')
    expect(html).toContain('Ana Bastos')
    expect(html).not.toContain('Assessoria')
    expect(html).toContain('Tendência')
    expect(html).toContain('Cobertura')
    expect(html).not.toContain('Cobertura da meta')
    expect(html).toContain('80%')
    expect(html).toContain('Faltam 300 votos para a meta')
    // B155: the Lideranças column chips the linked leaderships by name.
    expect(html).toContain('Lideranças')
    expect(html).toContain('Maria de Jesus')
    // B22 + B176: every one of the 11 visible-by-default staff columns carries
    // a header explanation — pinned inside `<thead>` itself, since `cellTooltip`
    // (e.g. "Classe") and the mobile card's own class tooltip (B42) add
    // triggers of their own. 11 = the 10 staff baseline + Dobradinha, which is
    // now staff-wide (B176).
    const [, tbodyHtml = ''] = html.split('<tbody')
    const theadHtml = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
    expect(theadHtml.match(/data-slot="tooltip-trigger"/g)).toHaveLength(11)

    // B158: the table is container-driven and clips instead of delegating to a
    // horizontal scroller. Município remains pinned and owns the territory subline.
    expect(html).toContain('data-container="municipality-list"')
    expect(html).toContain('@container/municipality-list')
    expect(html).toContain('@min-[48rem]/municipality-list:block')
    expect(html).toContain('@min-[48rem]/municipality-list:hidden')
    expect(html).toContain('data-slot="table-container"')
    expect(html).toContain('supports-[container-type:inline-size]:overflow-x-hidden')
    // overflow-x-auto is the fallback for browsers without container queries;
    // the test above still proves the container-query path takes precedence.
    expect(html).toContain('overflow-x-auto')
    expect(theadHtml).toContain('Município')
    expect(tbodyHtml).toContain('Seabra')
  })

  it('renders the Dobradinhas column for unrestricted staff with the advisors-style display', () => {
    const stateDeputyOptions: StateDeputyRelationOption[] = [
      { id: 11, name: 'Fulano (PT)', plainName: 'Fulano', party: 'PT', slug: 'fulano' },
      { id: 12, name: 'Beltrana (PSB)', plainName: 'Beltrana', party: 'PSB', slug: 'beltrana' },
    ]
    const baseRow = stub<MunicipalityListViewModel>({
      id: 1,
      name: 'Seabra',
      slug: 'seabra',
      kind: 'municipio',
      city: 'Seabra',
      region: 'Chapada Diamantina',
      ibgeCode: '2929800',
      zoneNumber: null,
      priority: 'normal',
      advisorIDs: [],
      leadershipIDs: [],
      lastUpdateAt: null,
      lastSignalAt: null,
      expectedVotes: toVoteEstimateScenarioViewModel(null),
      politicalTrendStatus: null,
      politicalTrendNote: null,
      engagementLevel: null,
      levelNote: null,
      levelChangedAt: null,
      pledges: createEmptyMunicipalityPledgeAggregate(),
      goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
      territorialClass: 'sem_base',
      territorialClassFactors: [],
    })
    const municipalities: MunicipalityListViewModel[] = [
      { ...baseRow, id: 1, stateDeputyIDs: [11, 12] },
      { ...baseRow, id: 2, name: 'Uauá', slug: 'uaua', stateDeputyIDs: [] },
    ]

    const html = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities,
        advisorNamesById: new Map(),
        ...municipalityListDefaultProps,
        isStaffView: true,
        isCampaignUnrestricted: true,
        stateDeputyOptions,
      }),
    )

    // B157/B158: Dobradinha adds one explanation to the 10-column staff baseline.
    const theadHtml = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
    expect(theadHtml.match(/data-slot="tooltip-trigger"/g)).toHaveLength(11)
    expect(theadHtml).toContain('Dobradinha')
    // Avatar-stack display: initials circles + the names in the trigger's
    // accessible label (the closed cell reads WHO is assigned without opening).
    expect(html).toContain('>F<') // Fulano
    expect(html).toContain('>B<') // Beltrana
    expect(html).toContain(
      'aria-label="Editar dobradinhas em Seabra — Fulano (PT), Beltrana (PSB)"',
    )
    // Empty município reads "—".
    expect(html).toContain('>—<')
  })

  it('shows the Dobradinhas column to the advisor and hides it from the leader', () => {
    const municipalities: MunicipalityListViewModel[] = [
      stub<MunicipalityListViewModel>({
        id: 1,
        name: 'Seabra',
        slug: 'seabra',
        kind: 'municipio',
        city: 'Seabra',
        region: 'Chapada Diamantina',
        ibgeCode: '2929800',
        zoneNumber: null,
        priority: 'normal',
        advisorIDs: [],
        leadershipIDs: [],
        stateDeputyIDs: [],
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
        engagementLevel: null,
        levelNote: null,
        levelChangedAt: null,
        pledges: createEmptyMunicipalityPledgeAggregate(),
        goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
        territorialClass: 'sem_base',
        territorialClassFactors: [],
      }),
    ]

    // B176 (2026-08-09): the Dobradinhas column is staff-wide — an advisor
    // sees it (the write is scoped to their portfolio server-side), while
    // the leader lockdown keeps it off the leader view.
    const advisorHtml = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities,
        advisorNamesById: new Map(),
        ...municipalityListDefaultProps,
        isStaffView: true,
        isCampaignUnrestricted: false,
      }),
    )
    expect(advisorHtml).toContain('Dobradinhas')

    const leaderHtml = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities,
        advisorNamesById: new Map(),
        ...municipalityListDefaultProps,
        isStaffView: false,
        isCampaignUnrestricted: false,
      }),
    )
    expect(leaderHtml).not.toContain('Dobradinhas')
  })

  /**
   * E10: the class is a suggestion, and a suggestion without its reason reads
   * as a verdict (research §6.4). The reason moved into the column's
   * `cellTooltip` so the cell stays narrow, so what this pins is that it is
   * still TEXT in the markup (`sr-only`) rather than a `title` attribute,
   * which reached neither keyboard nor touch. A município without a TSE
   * series must not wear a badge that implies a reading.
   */
  it('never renders a territorial class without its reason, and dashes the ones with no series', () => {
    const html = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities: [
          stub<MunicipalityListViewModel>({
            id: 1,
            name: 'Seabra',
            slug: 'seabra',
            kind: 'municipio',
            city: 'Seabra',
            region: 'Chapada Diamantina',
            advisorIDs: [],
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'normal',
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            pledges: createEmptyMunicipalityPledgeAggregate(),
            votePosition2022: null,
            territorialClass: 'reduto',
            territorialClassFactors: [
              { id: 'dominance', value: 2.4 },
              { id: 'ownShare', value: 0.031 },
            ],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
          }),
          stub<MunicipalityListViewModel>({
            id: 2,
            name: 'Sem série',
            slug: 'sem-serie',
            kind: 'municipio',
            city: 'Sem série',
            region: 'Chapada Diamantina',
            advisorIDs: [],
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'normal',
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            pledges: createEmptyMunicipalityPledgeAggregate(),
            votePosition2022: null,
            territorialClass: 'sem_base',
            territorialClassFactors: [],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
          }),
        ],
        advisorNamesById: new Map(),
        isStaffView: true,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Reduto')
    // The factors ride along as text, in the mesa's phrasing — never a `title`.
    expect(html).toContain('2,4× o padrão estadual do candidato')
    expect(html).not.toContain('title="2,4×')
    expect(html).not.toContain('Sem base')
    expect(html).toContain('Sem série do TSE para este município.')
  })

  /**
   * E9 allocation queue: the two row-level signals the queue is scanned for —
   * a priority município nobody answers for, and a signal that went cold.
   */
  it('names a priority município with no advisor and ages its last signal', () => {
    const staleDays = 40
    const staleSignal = new Date(Date.now() - staleDays * 86_400_000).toISOString()

    const html = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities: [
          {
            id: 9,
            name: 'Barreiras',
            slug: 'barreiras',
            kind: 'municipio',
            city: 'Barreiras',
            region: 'Bacia do Rio Grande',
            ibgeCode: '2903201',
            zoneNumber: null,
            advisorIDs: [],
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'alta',
            lastUpdateAt: staleSignal,
            lastSignalAt: staleSignal,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            engagementLevel: null,
            levelNote: null,
            levelChangedAt: null,
            pledges: createEmptyMunicipalityPledgeAggregate(),
            votePosition2022: null,
            territorialClass: 'expansao',
            territorialClassFactors: [{ id: 'field', value: 9000 }],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
          },
        ],
        advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
        isStaffView: true,
        ...municipalityListDefaultProps,
      }),
    )

    // "Sem assessor" still appears in the Assessores column (the avatar stack's
    // empty state); the status badge is what escalates to "Sem responsável".
    expect(html).toContain('Sem responsável')
    expect(html).toContain(`há ${staleDays} dias`)
    expect(html).toContain('data-signal="cold"')
    expect(html).toContain('Última atualização')
  })

  it('reads "Sem sinal" when nothing was ever recorded for the município', () => {
    const html = renderWithAppRouter(
      createElement(MunicipalityList, {
        municipalities: [
          {
            id: 10,
            name: 'Uauá',
            slug: 'uaua',
            kind: 'municipio',
            city: 'Uauá',
            region: 'Semiárido Nordeste II',
            ibgeCode: '2932002',
            zoneNumber: null,
            advisorIDs: [],
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'normal',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            engagementLevel: null,
            levelNote: null,
            levelChangedAt: null,
            pledges: createEmptyMunicipalityPledgeAggregate(),
            votePosition2022: null,
            territorialClass: 'expansao',
            territorialClassFactors: [{ id: 'field', value: 9000 }],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
          },
        ],
        advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
        isStaffView: true,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Sem sinal')
    expect(html).toContain('Sem assessor')
    expect(html).not.toContain('Sem responsável')
  })

  it('hides leadership coverage subline when pledges only have declared votes', () => {
    const html = renderWithAppRouter(
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
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'normal',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            engagementLevel: null,
            levelNote: null,
            levelChangedAt: null,
            pledges: {
              declaredTotal: 800,
              effectiveByScenario: { pessimistic: 800, central: 800, optimistic: 800 },
              pledgeCount: 1,
              missingEstimateCount: 1,
              lastPledgeAt: null,
            },
            votePosition2022: null,
            territorialClass: 'expansao',
            territorialClassFactors: [{ id: 'field', value: 9000 }],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
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
    const html = renderWithAppRouter(
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
            leadershipIDs: [],
            stateDeputyIDs: [],
            priority: 'alta',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
            engagementLevel: null,
            levelNote: null,
            levelChangedAt: null,
            pledges: createEmptyMunicipalityPledgeAggregate(),
            votePosition2022: null,
            territorialClass: 'expansao',
            territorialClassFactors: [{ id: 'field', value: 9000 }],
            goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
          },
        ],
        advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
        isStaffView: false,
        ...municipalityListDefaultProps,
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).not.toContain('Votos estimados')
    expect(html).not.toContain('Cenários de estimativa')
    expect(html).not.toContain('Faltam')
    expect(html).not.toContain('Prioritária')
    expect(html).not.toContain(`aria-label="${municipalityPriorityIndicatorLabel}"`)
    // B22/B158: the leader view keeps only Município, 2022 and Atualização;
    // all three carry header explanations.
    const [theadHtml] = html.split('<tbody')
    expect(theadHtml.match(/data-slot="tooltip-trigger"/g)).toHaveLength(3)
  })

  describe('B158 responsive municipality columns', () => {
    const renderResponsiveList = (hiddenColumnIds: string[] = []) =>
      renderWithAppRouter(
        createElement(MunicipalityList, {
          municipalities: [responsiveMunicipality],
          advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
          ...municipalityListDefaultProps,
          isStaffView: true,
          isCampaignUnrestricted: true,
          columnVisibility: { listId: 'municipios', hiddenColumnIds },
        }),
      )

    it('keeps the table order, territory subline, and symmetric container-query classes', () => {
      const html = renderResponsiveList()
      const theadHtml = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
      const tbodyHtml = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'))
      const labels = [
        'Município',
        '2022',
        '2026',
        'Nível',
        'Classe',
        'Assessor',
        'Tendência',
        'Liderança',
        'Dobradinha',
        'Cobertura',
        'Atualização',
      ]

      let previousIndex = -1
      for (const label of labels) {
        const labelIndex = theadHtml.indexOf(label)
        expect(labelIndex, `${label} deve aparecer depois da coluna anterior`).toBeGreaterThan(
          previousIndex,
        )
        previousIndex = labelIndex
      }

      expect(theadHtml).not.toContain('Território')
      const nameCellHtml = tbodyHtml.split('<td')[1] ?? ''
      expect(nameCellHtml).toContain('São Francisco do Conde com nome extenso')
      expect(nameCellHtml).toContain('Metropolitano de Salvador')
      expect(nameCellHtml).toContain('href="/campanha/territorios#ti-metropolitano-de-salvador"')

      for (const className of [
        'hidden @min-[54rem]/municipality-list:table-cell',
        'hidden @min-[66rem]/municipality-list:table-cell',
        'hidden @min-[72rem]/municipality-list:table-cell',
        'hidden @min-[78rem]/municipality-list:table-cell',
      ]) {
        expect(html.split(className)).toHaveLength(3)
      }
      expect(tbodyHtml).toContain('@min-[60rem]/municipality-list:hidden')
      expect(tbodyHtml).toContain('@min-[60rem]/municipality-list:inline-flex')
      expect(tbodyHtml).toContain('@min-[84rem]/municipality-list:hidden')
      expect(tbodyHtml).toContain('@min-[84rem]/municipality-list:block')

      const firstRowCells = tbodyHtml.split('<td').slice(1)
      expect(firstRowCells[3]?.split('</td>')[0]).toContain('>—</span>')
      expect(html).toContain('Sem nível')
    })

    it.each([
      { hidden: [], hasActions: false },
      { hidden: ['trend'], hasActions: true },
      { hidden: ['lastSignal'], hasActions: true },
      { hidden: ['trend', 'lastSignal'], hasActions: true },
    ])('mounts one trend and signal editor in the table for $hidden', ({ hidden, hasActions }) => {
      const html = renderResponsiveList(hidden)
      const tableHtml = html.slice(html.indexOf('<table'), html.indexOf('</table>'))
      const theadHtml = tableHtml.slice(tableHtml.indexOf('<thead'), tableHtml.indexOf('</thead>'))

      expect(tableHtml.match(/aria-label="Editar tendência política/g)).toHaveLength(1)
      expect(tableHtml.match(/aria-label="Registrar atualização em/g)).toHaveLength(1)
      expect(theadHtml.includes('Ações')).toBe(hasActions)
    })

    it('keeps removed and internal columns out of the municipality picker', () => {
      const columns = municipalityListPickerColumns({
        isStaffView: true,
      })

      expect(columns.map((column) => column.id)).toEqual([
        'name',
        'votos',
        'expectedVotes',
        'level',
        'classe',
        'advisors',
        'trend',
        'leaderships',
        'stateDeputies',
        'goalCoverage',
        'lastSignal',
      ])
      expect(columns).not.toContainEqual(expect.objectContaining({ id: 'region' }))
      expect(columns).not.toContainEqual(expect.objectContaining({ id: 'actions' }))
    })
  })

  /**
   * B23: the advisor stack only shows up to 3 initials (and initials
   * collide), so the full names ride along as redundant text. Radix mounts
   * tooltip content only once opened, so these pin the trigger half of the
   * contract — the same shape `campaignTable.unit.spec.ts` pins generically.
   */
  describe('B23 cell tooltips', () => {
    it('formats one advisor name per line and returns null for an empty list', () => {
      expect(formatAdvisorNamesTooltip([])).toBeNull()

      const one = renderToStaticMarkup(formatAdvisorNamesTooltip([{ id: 1, name: 'Ana Bastos' }])!)
      expect(one).toContain('Ana Bastos')

      const three = renderToStaticMarkup(
        formatAdvisorNamesTooltip([
          { id: 1, name: 'Ana Bastos' },
          { id: 2, name: 'Beto Lima' },
          { id: 3, name: 'Carla Dias' },
        ])!,
      )
      expect(three).toContain('Ana Bastos')
      expect(three).toContain('Beto Lima')
      expect(three).toContain('Carla Dias')
    })

    it('wraps the advisor cell in a tooltip only when there is a name to show', () => {
      // The staff `<thead>` already carries 10 header-explanation tooltips
      // (B22), regardless of row data. This baseline isolates the advisors
      // CELL tooltip, the one this test actually exercises.
      // 11 header explanations: the 10 staff columns + the now staff-wide
      // Dobradinhas (B176).
      const HEADER_TOOLTIP_COUNT = 11
      const baseMunicipality = {
        id: 1,
        name: 'Seabra',
        slug: 'seabra',
        kind: 'municipio' as const,
        city: 'Seabra',
        region: 'Chapada Diamantina',
        ibgeCode: '2929800',
        zoneNumber: null,
        advisorIDs: [],
        leadershipIDs: [],
        priority: 'normal' as const,
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
        engagementLevel: null,
        levelNote: null,
        levelChangedAt: null,
        pledges: createEmptyMunicipalityPledgeAggregate(),
        votePosition2022: null,
        territorialClass: 'sem_base' as const,
        territorialClassFactors: [],
        goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
      }

      const withAdvisors = renderWithTooltip(
        createElement(MunicipalityList, {
          municipalities: [{ ...baseMunicipality, advisorIDs: [7], stateDeputyIDs: [8] }],
          advisorNamesById: new Map([[7, { id: 7, name: 'Ana Bastos', phone: null }]]),
          isStaffView: true,
          ...municipalityListDefaultProps,
        }),
      )
      expect(withAdvisors.match(/data-slot="tooltip-trigger"/g)).toHaveLength(
        HEADER_TOOLTIP_COUNT + 1,
      )

      const withoutAdvisors = renderWithTooltip(
        createElement(MunicipalityList, {
          municipalities: [{ ...baseMunicipality, advisorIDs: [], stateDeputyIDs: [] }],
          advisorNamesById: new Map<number, MunicipalityAdvisorSummary>(),
          isStaffView: true,
          ...municipalityListDefaultProps,
        }),
      )
      expect(withoutAdvisors.match(/data-slot="tooltip-trigger"/g)).toHaveLength(
        HEADER_TOOLTIP_COUNT,
      )
      expect(withoutAdvisors).toContain('Sem assessor')
    })

    it("wraps the coordinator's advisor Popover trigger in a tooltip, never doubling the affordance", () => {
      const withAdvisors = renderWithTooltip(
        createElement(MunicipalityListAdvisorsControl, {
          municipalityID: 1,
          municipalityName: 'Feira de Santana',
          currentAdvisorIDs: [7],
          isPriority: false,
          advisorNamesById: new Map([[7, { id: 7, name: 'Ana Bastos', phone: null }]]),
          options: [],
          variant: 'popover',
        }),
      )
      expect(withAdvisors.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1)
      // The tooltip wraps the SAME trigger — nesting `asChild` composition
      // means only the outer wrapper's `data-slot` survives on the button,
      // but Popover's own trigger wiring (still the innermost primitive)
      // stays intact and functional.
      expect(withAdvisors).toContain('aria-haspopup="dialog"')

      const withoutAdvisors = renderWithTooltip(
        createElement(MunicipalityListAdvisorsControl, {
          municipalityID: 1,
          municipalityName: 'Feira de Santana',
          currentAdvisorIDs: [],
          isPriority: false,
          advisorNamesById: new Map(),
          options: [],
          variant: 'popover',
        }),
      )
      expect(withoutAdvisors).not.toContain('data-slot="tooltip-trigger"')
      expect(withoutAdvisors).toContain('data-slot="popover-trigger"')
      expect(withoutAdvisors).toContain('aria-haspopup="dialog"')
    })

    it('shows the trend justification on hover only when one was recorded', () => {
      const withNote = renderWithTooltip(
        createElement(MunicipalityListTrendControl, {
          municipalityID: 1,
          municipalityName: 'Feira de Santana',
          status: 'favoravel',
          trendNote: 'Vereador migrou para a base',
          variant: 'popover',
        }),
      )
      expect(withNote.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1)
      // Radix mounts tooltip content lazily — it never reaches the server
      // markup, same contract as `campaignTable.unit.spec.ts`.
      expect(withNote).not.toContain('Vereador migrou para a base')
      expect(withNote).toContain('aria-haspopup="dialog"')
      expect(withNote).not.toContain('Salvar')

      const withoutNote = renderWithTooltip(
        createElement(MunicipalityListTrendControl, {
          municipalityID: 1,
          municipalityName: 'Feira de Santana',
          status: 'favoravel',
          trendNote: null,
          variant: 'popover',
        }),
      )
      expect(withoutNote).not.toContain('data-slot="tooltip-trigger"')
    })
  })
})
