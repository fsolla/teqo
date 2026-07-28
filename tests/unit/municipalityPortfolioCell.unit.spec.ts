import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
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
 * Two municípios that are the WHOLE of their território, so the chip collapses
 * and removing it is a multi-id delta — which is what raises the undo toast.
 */
const INDEX: MunicipalityPortfolioIndexEntry[] = [
  { id: 1, name: 'Feira de Santana', slug: 'feira-de-santana', region: 'Portal do Sertão' },
  { id: 2, name: 'Serrinha', slug: 'serrinha', region: 'Portal do Sertão' },
  { id: 3, name: 'Ilhéus', slug: 'ilheus', region: 'Litoral Sul' },
  // Never assigned, and load-bearing: without a second entry in its território,
  // Ilhéus alone would BE Litoral Sul and collapse into a território chip.
  { id: 4, name: 'Itabuna', slug: 'itabuna', region: 'Litoral Sul' },
]

const cell = (municipalityIds: number[]) =>
  createElement(MunicipalityPortfolioCell, {
    ownerId: 7,
    ownerName: 'Maria Souza',
    municipalityIds,
    municipalityIndex: INDEX,
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
    const { rerender } = render(cell([1, 2]))

    // 1. Drop the território (ids 1 and 2) — a multi-id delta, so it toasts.
    fireEvent.click(screen.getByRole('button', { name: 'Remover Portal do Sertão — 2 municípios' }))
    await waitFor(() => expect(toastActions).toHaveLength(1))

    // 2. The write landed and the server re-rendered the row empty.
    rerender(cell([]))

    // 3. A LATER edit the undo closure knows nothing about.
    rerender(cell([3]))
    expect(screen.getByText('Ilhéus')).toBeTruthy()

    // 4. Undo. It must ADD the território back, never rewind the row to step 1.
    await act(async () => {
      toastActions[0]?.onClick()
    })

    await waitFor(() => expect(screen.getByText('Portal do Sertão')).toBeTruthy())
    expect(screen.getByText('Ilhéus')).toBeTruthy()
  })
})
