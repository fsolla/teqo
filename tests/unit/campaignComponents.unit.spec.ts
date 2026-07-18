import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { LeadershipRow } from '@/components/campaign/LeadershipRow'
import { NucleusCard } from '@/components/campaign/NucleusCard'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { VoteEstimateCard } from '@/components/campaign/VoteEstimateCard'
import { Progress } from '@/components/ui/Progress'
import { Toggle } from '@/components/ui/Toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { buildGeneralDashboardViewModel } from '@/utilities/campaignDashboardViewModels'

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
      createElement(CampaignScopeBadge, null, '3 núcleos sob sua coordenação'),
    )

    expect(html).toContain('3 núcleos sob sua coordenação')
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

  it('aggregates every typed dashboard support status exhaustively', () => {
    const view = buildGeneralDashboardViewModel(
      [],
      [
        { nucleusId: 31, supportStatus: 'engajado' },
        { nucleusId: 31, supportStatus: 'a_abordar' },
        { nucleusId: 31, supportStatus: 'em_disputa' },
        { nucleusId: 31, supportStatus: 'negativo' },
      ],
      0,
      new Date('2026-07-18T12:00:00-03:00'),
      [],
    )

    expect(view.supportCounts).toEqual({
      engajado: 1,
      a_abordar: 1,
      em_disputa: 1,
      negativo: 1,
    })
  })

  it('qualifies TSE zones instead of showing an ambiguous number', () => {
    const html = renderToStaticMarkup(createElement(TseZoneBadge, { zoneNumber: 12 }))

    expect(html).toContain('ZE 12')
    expect(html).toContain('aria-label="Zona Eleitoral TSE 12"')
  })

  it('keeps the confirmed estimate primary and a proposal secondary', () => {
    const html = renderToStaticMarkup(
      createElement(VoteEstimateCard, {
        confirmedEstimate: 1200,
        confirmedBy: 'João S.',
        confirmedAt: '12/07',
        proposedEstimate: 1450,
        proposedBy: 'Maria A.',
      }),
    )

    expect(html).toContain('1.200 votos')
    expect(html).toContain('Confirmada')
    expect(html).toContain('Sugestão pendente')
    expect(html).toContain('1.450 votos')
    expect(html.indexOf('1.200 votos')).toBeLessThan(html.indexOf('1.450 votos'))
    expect(html).toContain('data-slot="alert"')
    expect(html).not.toContain('text-3xl')
  })

  it('renders nucleus territory, TSE zones, cadence, and leadership summary', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusCard, {
        name: 'Quilombo Rio das Rãs',
        territory: 'Comunidade · Bom Jesus da Lapa',
        tseZones: [12],
        confirmedVoteEstimate: 1200,
        hasPendingEstimate: true,
        lastUpdateLabel: 'Última atualização há 10 dias',
        isUpdateOverdue: true,
        leadershipCounts: { engaged: 5, toApproach: 3, disputed: 1 },
      }),
    )

    expect(html).toContain('Quilombo Rio das Rãs')
    expect(html).toContain('Comunidade · Bom Jesus da Lapa')
    expect(html).toContain('ZE 12')
    expect(html).toContain('1.200 votos')
    expect(html).toContain('Sugestão pendente')
    expect(html).toContain('5 engajadas')
    expect(html).toContain('Atualização atrasada')
  })

  it('makes missing TSE coverage visible as incomplete data', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusCard, {
        name: 'Núcleo em mapeamento',
        territory: 'Região · Bahia',
        tseZones: [],
      }),
    )

    expect(html).toContain('Sem Zona TSE')
  })

  it('renders leadership identity with avatar fallback and support status', () => {
    const html = renderToStaticMarkup(
      createElement(LeadershipRow, {
        name: 'Maria Aparecida',
        phone: '71 97654-3210',
        sector: 'Religioso',
        supportStatus: 'engajado',
        href: '/campanha/nucleos/centro?tab=leaderships&leadership=31',
        rowId: 'leadership-row-31',
      }),
    )

    expect(html).toContain('MA')
    expect(html).toContain('Maria Aparecida')
    expect(html).toContain('71 97654-3210')
    expect(html).toContain('Religioso')
    expect(html).toContain('Engajado')
    expect(html).toContain('href="/campanha/nucleos/centro?tab=leaderships')
  })
})
