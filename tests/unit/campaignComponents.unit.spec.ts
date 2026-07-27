import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { formatAdvisorNamesTooltip } from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityList } from '@/components/campaign/municipality/MunicipalityList'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { TseZoneBadge } from '@/components/campaign/municipality/TseZoneBadge'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { Progress } from '@/components/ui/Progress'
import { Toggle } from '@/components/ui/Toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { createEmptyGoalCoverageByScenario } from '@/utilities/goalCoverage'
import type {
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipalityViewModels'
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
  advisorOptions: [],
  columnFilterOptions: { name: [], region: [], advisor: [] },
  signalFormAction: noopListFormAction,
  state: { page: 1 },
}

const mockAppRouter = stub<Parameters<typeof AppRouterContext.Provider>[0]['value']>({
  push: () => {},
  replace: () => {},
  refresh: () => {},
  forward: () => {},
  back: () => {},
  prefetch: () => Promise.resolve(),
})

const renderWithAppRouter = (element: React.ReactElement) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: mockAppRouter }, element))

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
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/shell/CampaignSidebar.tsx'),
      'utf8',
    )

    expect(layoutSource).toContain(
      'className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible"',
    )
    expect(layoutSource).toContain('data-slot="campaign-content-scroll"')
    expect(layoutSource).toContain('min-h-0 flex-1 overflow-y-auto overscroll-contain')
    expect(layoutSource).toContain(
      'hidden min-h-11 shrink-0 items-center gap-2 border-b border-border px-4 md:flex print:hidden',
    )
    expect(sidebarSource).toContain('collapsible="offcanvas"')
    expect(sidebarSource).toContain('print:hidden')
  })

  it('uses light sidebar tokens and readable logout states', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')
    const sidebarSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/shell/CampaignSidebar.tsx'),
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
        lastSignalAt: null,
        expectedVotes: { pessimistic: null, central: 1500, optimistic: null },
        politicalTrendStatus: 'favoravel',
        politicalTrendNote: null,
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
        priority: 'normal',
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
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
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).toContain('Chapada Diamantina')
    expect(html).toContain('href="/campanha/territorios#ti-chapada-diamantina"')
    expect(html).toContain('href="/campanha/municipios/seabra"')
    expect(html).toContain('1.500')
    expect(html).toContain('Cenários de estimativa')
    expect(html).toContain('Prioritária')
    // The advisor column carries coverage on its own — no separate "Assessoria" column.
    expect(html).toContain('Assessores')
    expect(html).toContain('Ana Bastos')
    expect(html).not.toContain('Assessoria')
    expect(html).toContain('Tendência')
    expect(html).toContain('Cobertura da meta')
    expect(html).toContain('80%')
    expect(html).toContain('Faltam 300 votos para a meta')
    // B22: every one of the 10 staff columns carries a header explanation —
    // pinned inside `<thead>` itself, since `cellTooltip` (e.g. "Classe") and
    // the mobile card's own class tooltip (B42) add triggers of their own.
    const [, tbodyHtml = ''] = html.split('<tbody')
    const theadHtml = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
    expect(theadHtml.match(/data-slot="tooltip-trigger"/g)).toHaveLength(10)

    // B41: horizontal scroll + sticky Município (Territory pattern).
    expect(html).toMatch(/data-slot="table-container"[^>]*class="[^"]*overflow-x-auto/)
    expect(theadHtml).toMatch(/sticky left-0 z-20[^"]*min-w-56[^"]*bg-background/)
    expect(tbodyHtml).toMatch(/sticky left-0 z-\[5\][^"]*min-w-56[^"]*bg-background/)
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
            priority: 'alta',
            lastUpdateAt: staleSignal,
            lastSignalAt: staleSignal,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
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
    expect(html).toContain('Último sinal')
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
            priority: 'normal',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
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
            priority: 'normal',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
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
            priority: 'alta',
            lastUpdateAt: null,
            lastSignalAt: null,
            expectedVotes: toVoteEstimateScenarioViewModel(null),
            politicalTrendStatus: null,
            politicalTrendNote: null,
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
    expect(html).not.toContain('Cobertura')
    expect(html).not.toContain('Prioritária')
    // B22: the leader view's 5 columns (name/region/kind/votos/lastUpdateAt)
    // also carry header explanations.
    const [theadHtml] = html.split('<tbody')
    expect(theadHtml.match(/data-slot="tooltip-trigger"/g)).toHaveLength(5)
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
      const HEADER_TOOLTIP_COUNT = 10
      const baseMunicipality = {
        id: 1,
        name: 'Seabra',
        slug: 'seabra',
        kind: 'municipio' as const,
        city: 'Seabra',
        region: 'Chapada Diamantina',
        ibgeCode: '2929800',
        zoneNumber: null,
        priority: 'normal' as const,
        lastUpdateAt: null,
        lastSignalAt: null,
        expectedVotes: toVoteEstimateScenarioViewModel(null),
        politicalTrendStatus: null,
        politicalTrendNote: null,
        pledges: createEmptyMunicipalityPledgeAggregate(),
        votePosition2022: null,
        territorialClass: 'sem_base' as const,
        territorialClassFactors: [],
        goalCoverageByScenario: createEmptyGoalCoverageByScenario(),
      }

      const withAdvisors = renderToStaticMarkup(
        createElement(MunicipalityList, {
          municipalities: [{ ...baseMunicipality, advisorIDs: [7] }],
          advisorNamesById: new Map([[7, { id: 7, name: 'Ana Bastos', phone: null }]]),
          isStaffView: true,
          ...municipalityListDefaultProps,
        }),
      )
      expect(withAdvisors.match(/data-slot="tooltip-trigger"/g)).toHaveLength(
        HEADER_TOOLTIP_COUNT + 1,
      )

      const withoutAdvisors = renderToStaticMarkup(
        createElement(MunicipalityList, {
          municipalities: [{ ...baseMunicipality, advisorIDs: [] }],
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
      const withAdvisors = renderToStaticMarkup(
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

      const withoutAdvisors = renderToStaticMarkup(
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
      const withNote = renderToStaticMarkup(
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

      const withoutNote = renderToStaticMarkup(
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
