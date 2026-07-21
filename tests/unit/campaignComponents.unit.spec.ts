import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { PlazaList } from '@/components/campaign/PlazaList'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { Progress } from '@/components/ui/Progress'
import { Toggle } from '@/components/ui/Toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import type { PlazaAdvisorSummary, PlazaListViewModel } from '@/utilities/plazaViewModels'
import { emptyPlazaPledgeAggregate } from '@/utilities/votePledgeData'

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

  it('renders plaza rows with geography, pledges, and advisor coverage for staff', () => {
    const advisor: PlazaAdvisorSummary = { id: 7, name: 'Ana Bastos', phone: null }
    const plazas: PlazaListViewModel[] = [
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
        expectedVotes: 1500,
        pledges: {
          declaredTotal: 1200,
          effectiveTotal: 1200,
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
        expectedVotes: null,
        pledges: { ...emptyPlazaPledgeAggregate },
      },
    ]

    const html = renderToStaticMarkup(
      createElement(PlazaList, {
        plazas,
        advisorNamesById: new Map([[advisor.id, advisor]]),
        isStaffView: true,
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).toContain('Chapada Diamantina')
    expect(html).toContain('href="/campanha/pracas/seabra"')
    expect(html).toContain('1.500')
    expect(html).toContain('Nas lideranças: 1.200')
    expect(html).toContain('Prioritária')
    expect(html).toContain('Coberta')
    expect(html).toContain('Sem assessor')
  })

  it('hides staff-only pledge and coverage columns from the leader view', () => {
    const html = renderToStaticMarkup(
      createElement(PlazaList, {
        plazas: [
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
            expectedVotes: null,
            pledges: { ...emptyPlazaPledgeAggregate },
          },
        ],
        advisorNamesById: new Map<number, PlazaAdvisorSummary>(),
        isStaffView: false,
      }),
    )

    expect(html).toContain('Seabra')
    expect(html).not.toContain('Votos estimados')
    expect(html).not.toContain('Cobertura')
    expect(html).not.toContain('Prioritária')
  })
})
