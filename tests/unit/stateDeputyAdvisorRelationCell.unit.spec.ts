import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { StateDeputyAdvisorRelationCell } from '@/components/campaign/stateDeputy/StateDeputyAdvisorRelationCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/**
 * B156: pins what the advisor wrapper contributes over the shared
 * `RelationOptionCell` — the write's field names, the link target, the
 * read-only rendering for non-unrestricted staff, and the success feedback.
 */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const OPTIONS = [
  {
    id: 10,
    searchLabel: 'Ana Bastos',
    item: { id: 10, label: 'Ana Bastos', href: '/campanha/assessores/10' },
  },
  {
    id: 11,
    searchLabel: 'Beto Lima',
    item: { id: 11, label: 'Beto Lima', href: '/campanha/assessores/11' },
  },
]

const advisors = [{ id: 10, name: 'Ana Bastos' }]

const cell = (
  overrides: Partial<{
    advisors: Array<{ id: number; name: string }>
    readOnly: boolean
    membershipAction: (
      state: CampaignFormActionState,
      formData: FormData,
    ) => Promise<CampaignFormActionState>
  }> = {},
) =>
  createElement(StateDeputyAdvisorRelationCell, {
    stateDeputyId: 7,
    stateDeputyName: 'Dobradinha Teste',
    advisors: overrides.advisors ?? advisors,
    options: OPTIONS,
    membershipAction: overrides.membershipAction ?? (async () => ({ status: 'success' as const })),
    readOnly: overrides.readOnly ?? false,
    measureOverflow: false,
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

afterEach(cleanup)
afterAll(() => vi.unstubAllGlobals())

describe('state deputy advisor relation cell (B156)', () => {
  it('renders each assigned advisor as a linked chip', () => {
    render(cell())

    const link = screen.getByRole('link', { name: 'Ana Bastos' })
    expect(link.getAttribute('href')).toBe('/campanha/assessores/10')
  })

  it('sends stateDeputyId/advisorId/assigned=false on removal', async () => {
    const membershipAction = vi.fn(
      async (_state: CampaignFormActionState, _formData: FormData) =>
        ({ status: 'success' as const }) satisfies CampaignFormActionState,
    )
    render(cell({ membershipAction }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Bastos' }))

    await waitFor(() => expect(membershipAction).toHaveBeenCalledTimes(1))
    const formData = membershipAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('stateDeputyId')).toBe('7')
    expect(formData.get('advisorId')).toBe('10')
    expect(formData.get('assigned')).toBe('false')
  })

  it('adds a searched option and reports the live region as saved', async () => {
    render(cell())

    fireEvent.click(screen.getByRole('button', { name: 'Editar assessores de Dobradinha Teste' }))
    const dialog = await screen.findByRole('dialog')
    const searchInput = within(dialog).getByRole('combobox', { name: 'Buscar assessor' })
    fireEvent.change(searchInput, { target: { value: 'Beto' } })

    fireEvent.click(await within(dialog).findByRole('option', { name: /Beto Lima/ }))

    await waitFor(() => expect(within(dialog).getByText('Beto Lima')).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Assessores salvos.'))
  })

  it('readOnly renders chips with no edit affordances', () => {
    render(cell({ readOnly: true }))

    // No link: `/campanha/assessores/[id]` is unrestricted-only, so a read-only
    // viewer must not be handed a dead-end redirect (B156 simplify fix).
    expect(screen.queryByRole('link', { name: 'Ana Bastos' })).toBeNull()
    expect(screen.getByText('Ana Bastos')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remover Ana Bastos' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Editar assessores de Dobradinha Teste' }),
    ).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows the empty dash when there are no advisors yet', () => {
    render(cell({ advisors: [] }))
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('undoes a failed removal without reverting a sibling change from the same render', async () => {
    const membershipAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        message: 'Não foi possível atualizar os assessores. Tente novamente.',
      }),
    )
    render(cell({ membershipAction }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Bastos' }))
    })

    await waitFor(() => expect(screen.getByText('Ana Bastos')).toBeTruthy())
  })
})
