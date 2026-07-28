import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import type { CampaignCellEditOverlayVariant } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

/**
 * B42: the quick-edit cells of `/campanha/municipios` share one container
 * (`CampaignCellEditOverlay`) that is a Popover in the desktop table and a
 * bottom Drawer in the mobile card. These cases pin the part a call site can
 * silently get wrong — which container it renders and whether the touch surface
 * says which município is being edited — for all of them at once. Three
 * auto-save; the level cell (E14) submits explicitly and is here for the
 * container contract all four share.
 */
const MUNICIPALITY_NAME = 'Feira de Santana'

type OverlayCase = {
  name: string
  /**
   * The accessible name of the trigger. It replaces the pill / avatar stack /
   * number it wraps, so it has to carry that value — each case spells the value
   * out, which is the part a refactor drops without noticing.
   */
  triggerLabel: string
  /** Text the Drawer header must carry beyond the município name. */
  drawerTitle: string
  element: (variant: CampaignCellEditOverlayVariant) => ReactElement
}

const overlayCases: OverlayCase[] = [
  {
    name: 'tendência',
    triggerLabel: `Editar tendência política em ${MUNICIPALITY_NAME} — Favorável`,
    drawerTitle: 'Editar tendência',
    element: (variant) =>
      createElement(MunicipalityListTrendControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        status: 'favoravel',
        trendNote: 'Vereador migrou para a base',
        variant,
      }),
  },
  {
    name: 'assessores',
    triggerLabel: `Editar assessores em ${MUNICIPALITY_NAME} — Ana Bastos`,
    drawerTitle: 'Atribuir assessores',
    element: (variant) =>
      createElement(MunicipalityListAdvisorsControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        currentAdvisorIDs: [7],
        isPriority: false,
        advisorNamesById: new Map([[7, { id: 7, name: 'Ana Bastos', phone: null }]]),
        options: [{ id: 7, name: 'Ana Bastos', isCurrent: false }],
        variant,
      }),
  },
  {
    name: 'votos estimados',
    triggerLabel: `Editar votos estimados em ${MUNICIPALITY_NAME} — Média: 1.200`,
    drawerTitle: 'Editar votos estimados',
    element: (variant) =>
      createElement(MunicipalityListExpectedVotesControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        expectedVotes: toVoteEstimateScenarioViewModel({ central: 1200 }),
        pledgeCoverage: null,
        variant,
      }),
  },
  {
    name: 'nível de envolvimento',
    triggerLabel: `Nível de envolvimento de ${MUNICIPALITY_NAME}: N3 · Rede + agenda`,
    drawerTitle: 'Registrar nível de envolvimento',
    element: (variant) =>
      createElement(MunicipalityListLevelControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        level: 'n3',
        levelNote: 'Rede montada e giro agendado',
        levelChangedAt: '2026-07-01T12:00:00.000Z',
        variant,
      }),
  },
]

beforeAll(() => {
  // The advisors control renders `cmdk`, which measures its list and keeps the
  // selected item in view. jsdom implements neither. Same `ResizeObserver` stub
  // as `campaignCompositionCleanup.unit.spec.ts`.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

afterEach(cleanup)

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('campaign cell edit overlay', () => {
  it.each(overlayCases)(
    'opens $name in a Drawer that names the município on touch',
    async ({ triggerLabel, drawerTitle, element }) => {
      render(element('sheet'))

      fireEvent.click(screen.getByRole('button', { name: triggerLabel }))

      const dialog = await screen.findByRole('dialog')
      const title = dialog.querySelector('[data-slot="drawer-title"]')
      expect(title?.textContent).toBe(drawerTitle)
      expect(dialog.querySelector('[data-slot="drawer-description"]')?.textContent).toBe(
        MUNICIPALITY_NAME,
      )
      // Focus lands on the title, never on a field: on touch the alternative is
      // the virtual keyboard covering the sheet before it can be read. Awaited
      // because the advisors sheet mounts `cmdk`, which delays it by a tick.
      await waitFor(() => expect(document.activeElement).toBe(title))
      // Swiping down is the gesture, but it is not an affordance anyone sees.
      expect(dialog.textContent).toContain('Fechar')
      expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()
    },
  )

  it.each(overlayCases)(
    'keeps $name in a Popover on the desktop table',
    async ({ triggerLabel, element }) => {
      render(element('popover'))

      const trigger = screen.getByRole('button', { name: triggerLabel })
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')

      fireEvent.click(trigger)

      await screen.findByRole('dialog')
      expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull()
      expect(document.querySelector('[data-slot="drawer-popup"]')).toBeNull()
      // Header and subject line are Drawer chrome. A Popover is anchored to the
      // trigger it came from, and that trigger's accessible name already carries
      // both the município and the current value.
      expect(document.querySelector('[data-slot="drawer-title"]')).toBeNull()
      expect(document.querySelector('[data-slot="drawer-description"]')).toBeNull()
    },
  )

  /**
   * B34's cell is the one caller that is a sheet at EVERY viewport: it picks its
   * surface by `pointer:`, not by width, so it has no `variant` to sweep and
   * cannot join the cases above. It is here for the half it does share — the
   * sheet chrome and, above all, `initialFocus`: its own Drawer used to hand
   * focus to the first chip, a link that navigates away from the row being
   * edited.
   */
  it('opens the município portfolio in a Drawer focused on its title', async () => {
    render(
      createElement(MunicipalityPortfolioCell, {
        ownerId: 1,
        ownerName: 'Maria Souza',
        municipalityIds: [11],
        municipalityIndex: [
          { id: 11, name: MUNICIPALITY_NAME, slug: 'feira-de-santana', region: 'Portal do Sertão' },
        ],
        commitAction: async () => ({}),
        drawerTitle: 'Editar municípios',
        updateErrorMessage: 'Não foi possível atualizar os municípios.',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar municípios de Maria Souza' }))

    const dialog = await screen.findByRole('dialog')
    const title = dialog.querySelector('[data-slot="drawer-title"]')
    expect(title?.textContent).toBe('Editar municípios')
    expect(dialog.querySelector('[data-slot="drawer-description"]')?.textContent).toBe(
      'Maria Souza',
    )
    await waitFor(() => expect(document.activeElement).toBe(title))
    expect(dialog.textContent).toContain('Fechar')
  })
})
