import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'

type ToastAction = { label: string; onClick: () => void }

const toastActions: ToastAction[] = []

vi.mock('sonner', () => ({
  toast: {
    success: (_message: string, options?: { action?: ToastAction }) => {
      if (options?.action) toastActions.push(options.action)
    },
    error: () => {},
  },
}))

/**
 * Real slugs, because the cell resolves name and território from the static
 * catalog: Itaparica is the smallest TI (6 municípios), so assigning all of it
 * collapses to one chip and removing that chip is a multi-id delta — which is
 * what raises the undo toast. Ilhéus stands in for a later, unrelated edit;
 * Itabuna is never assigned and is load-bearing, since without a second entry
 * of Litoral Sul left over, Ilhéus alone would collapse into a território chip.
 */
const TERRITORY = 'Itaparica'
const TERRITORY_SLUGS = municipalityCatalog
  .filter((entry) => entry.region === TERRITORY)
  .map((entry) => entry.slug)

const INDEX: MunicipalityPortfolioIndexEntry[] = [
  ...TERRITORY_SLUGS.map((slug, position) => ({ id: position + 1, slug })),
  { id: 90, slug: 'ilheus' },
  { id: 91, slug: 'itabuna' },
]

const TERRITORY_IDS = INDEX.slice(0, TERRITORY_SLUGS.length).map((entry) => entry.id)
const ILHEUS_ID = 90

const cell = (municipalityIds: number[], index: MunicipalityPortfolioIndexEntry[] = INDEX) =>
  createElement(MunicipalityPortfolioCell, {
    ownerId: 7,
    ownerName: 'Maria Souza',
    municipalityIds,
    municipalityIndex: index,
    commitAction: async () => ({ status: 'success' as const }),
    drawerTitle: 'Editar municípios',
    updateErrorMessage: 'Não foi possível atualizar os municípios.',
  })

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  toastActions.length = 0
  cleanup()
})

afterAll(() => vi.unstubAllGlobals())

describe('município portfolio cell — optimistic baseline', () => {
  /**
   * Regression pin for a bug that has now been written twice: the delta itself
   * was already applied functionally, but the fallback the updater takes when
   * the optimistic value is null read the `municipalityIds` of the render that
   * created the closure. The toast's "Desfazer" is the one caller that outlives
   * its render, so pressing it after a later edit rebuilt the row from a set
   * that predated that edit — and because the reconcile effect only clears on an
   * exact match, the row stayed wrong through every later revalidation.
   */
  it('undoes a removal against the current set, not the one its render captured', async () => {
    const { rerender } = render(cell(TERRITORY_IDS))

    // 1. Drop the whole território — a multi-id delta, so it toasts.
    fireEvent.click(
      screen.getByRole('button', {
        name: `Remover ${TERRITORY} — ${TERRITORY_SLUGS.length} municípios`,
      }),
    )
    await waitFor(() => expect(toastActions).toHaveLength(1))

    // 2. The write landed and the server re-rendered the row empty.
    rerender(cell([]))

    // 3. A LATER edit the undo closure knows nothing about.
    rerender(cell([ILHEUS_ID]))
    expect(screen.getByText('Ilhéus')).toBeTruthy()

    // 4. Undo. It must ADD the território back, never rewind the row to step 1.
    await act(async () => {
      toastActions[0]?.onClick()
    })

    await waitFor(() => expect(screen.getByText(TERRITORY)).toBeTruthy())
    expect(screen.getByText('Ilhéus')).toBeTruthy()
  })
})

describe('município portfolio cell — Salvador aggregate suggestion (C131)', () => {
  // The default INDEX has no Salvador zones, so this test builds its own: the 19
  // zone entries (the aggregate's search target) plus Ilhéus, so a non-matching
  // sibling proves the suggestion is scoped to the query.
  const SALVADOR_INDEX: MunicipalityPortfolioIndexEntry[] = [
    ...municipalityCatalog
      .filter((entry) => entry.city === 'Salvador')
      .map((entry, position) => ({ id: position + 1, slug: entry.slug })),
    { id: 90, slug: 'ilheus' },
  ]

  it('offers "Salvador — Todas as zonas" as the first suggestion for "salvador"', async () => {
    render(cell([], SALVADOR_INDEX))

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Buscar município, território de identidade ou zona eleitoral',
      }),
      { target: { value: 'salvador' } },
    )

    const options = await screen.findAllByRole('option')
    const first = options[0]
    expect(first?.textContent).toContain('Salvador')
    expect(first?.textContent).toContain('Todas as zonas')
  })
})
