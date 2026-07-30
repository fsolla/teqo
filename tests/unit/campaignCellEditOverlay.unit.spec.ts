import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { MunicipalityListSignalControl } from '@/components/campaign/municipality/MunicipalityListSignalControl'
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
  /**
   * Label of the sheet's primary footer action, for the cells whose commit is
   * an explicit submit (B32+ F5). A footer REPLACES the default "Fechar", so
   * the two assertions are exclusive.
   */
  footerLabel?: string
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
    footerLabel: 'Registrar movimento',
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
  {
    name: 'sinal',
    triggerLabel: `Registrar sinal em ${MUNICIPALITY_NAME} — Sem sinal`,
    drawerTitle: 'Registrar sinal',
    footerLabel: 'Registrar sinal',
    element: (variant) =>
      // `createElement`'s typing puts a required `children` in props, so the
      // rest-argument form this rule prefers does not type-check here.
      // eslint-disable-next-line react/no-children-prop
      createElement(MunicipalityListSignalControl, {
        municipalityID: 1,
        municipalitySlug: 'feira-de-santana',
        municipalityName: MUNICIPALITY_NAME,
        lastSignalAt: null,
        variant,
        formAction: async () => ({}),
        children: createElement('span', null, 'Sem sinal'),
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
    async ({ triggerLabel, drawerTitle, footerLabel, element }) => {
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
      const footer = dialog.querySelector('[data-slot="drawer-footer"]')
      if (footerLabel) {
        // A footer replaces the default dismissal: the commit is the primary
        // action and "Cancelar" is what stands in for "Fechar".
        expect(footer?.textContent).toContain(footerLabel)
        expect(footer?.textContent).not.toContain('Fechar')
      } else {
        // Swiping down is the gesture, but it is not an affordance anyone sees.
        expect(footer?.textContent).toContain('Fechar')
      }
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
   * B32+ F4. The region used to live inside the overlay, and closing is exactly
   * what commits a draft — so the announcement that mattered most was the one
   * that unmounted before it could be read. It now sits beside the trigger,
   * which outlives the dialog.
   */
  /**
   * The other half of the same policy: a region mounted on every row would
   * register ~250 polite live regions on one município page (5 controls × the
   * card and table trees), so it appears with the first open — early enough for
   * "Salvando…", which cannot happen before one.
   */
  it('does not mount the live region until the overlay has been opened once', () => {
    render(
      createElement(MunicipalityListTrendControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        status: 'favoravel',
        trendNote: null,
        variant: 'popover',
      }),
    )

    expect(document.querySelector('[aria-live="polite"]')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', {
        name: `Editar tendência política em ${MUNICIPALITY_NAME} — Favorável`,
      }),
    )

    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('keeps the live region mounted after the overlay closes', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise(() => {
          // Never settles: "Salvando…" is the state under test.
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      createElement(MunicipalityListTrendControl, {
        municipalityID: 1,
        municipalityName: MUNICIPALITY_NAME,
        status: 'favoravel',
        trendNote: null,
        variant: 'popover',
      }),
    )

    const trigger = screen.getByRole('button', {
      name: `Editar tendência política em ${MUNICIPALITY_NAME} — Favorável`,
    })
    fireEvent.click(trigger)

    const select = await screen.findByLabelText('Tendência')
    fireEvent.change(select, { target: { value: 'desfavoravel' } })
    // Dismissing flushes the debounced save, and the dialog goes with it.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await waitFor(() => {
      const region = document.querySelector('[aria-live="polite"]')
      expect(region?.textContent).toBe('Salvando tendência.')
    })
  })

  /**
   * The sheet's submit sits in the footer, OUTSIDE the `<form>` it belongs to —
   * associated by the standard `form` attribute. This case is what says that
   * association still reaches React's action (B32+ F5); without it the button
   * would look right and do nothing.
   */
  it('submits the signal form from a button rendered in the sheet footer', async () => {
    const formAction = vi.fn(async () => ({}))

    render(
      // `createElement`'s typing puts a required `children` in props, so the
      // rest-argument form this rule prefers does not type-check here.
      // eslint-disable-next-line react/no-children-prop
      createElement(MunicipalityListSignalControl, {
        municipalityID: 1,
        municipalitySlug: 'feira-de-santana',
        municipalityName: MUNICIPALITY_NAME,
        lastSignalAt: null,
        variant: 'sheet',
        formAction,
        children: createElement('span', null, 'Sem sinal'),
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: `Registrar sinal em ${MUNICIPALITY_NAME} — Sem sinal` }),
    )

    const dialog = await screen.findByRole('dialog')
    // The select is `required`: an invalid form never fires submit, and the
    // case would pass for the wrong reason.
    fireEvent.change(screen.getByLabelText('Tipo do sinal'), { target: { value: 'invasao' } })

    const submit = dialog.querySelector<HTMLButtonElement>('[data-slot="drawer-footer"] button')
    expect(submit?.textContent).toContain('Registrar sinal')
    expect(submit?.getAttribute('form')).toBe(
      dialog.querySelector('form')?.getAttribute('id') ?? null,
    )

    fireEvent.click(submit as HTMLButtonElement)

    await waitFor(() => expect(formAction).toHaveBeenCalledTimes(1))
  })

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
        municipalityIndex: [{ id: 11, slug: 'feira-de-santana' }],
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
