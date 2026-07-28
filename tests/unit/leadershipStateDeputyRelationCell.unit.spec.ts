import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  LeadershipStateDeputyRelationCell,
  type RelationCellItem,
  type RelationCellOption,
} from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/**
 * B37: this cell used to have its own Popover+Command implementation and zero
 * coverage. It is now a thin wrapper over `RelationChipCell` — the same engine
 * `MunicipalityPortfolioCell` uses — so these pins cover what changed for it:
 * the write's field names per `direction`, the party suffix, and the success
 * feedback the old Popover never gave (no toast, but the live region says so).
 */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const OPTIONS: RelationCellOption[] = [
  {
    id: 10,
    searchLabel: 'Ana Bastos',
    item: { id: 10, label: 'Ana Bastos', href: '/campanha/dobradinhas/10' },
  },
  {
    id: 11,
    searchLabel: 'Beto Lima',
    item: { id: 11, label: 'Beto Lima', href: '/campanha/dobradinhas/11', party: 'PT' },
  },
]

const items: RelationCellItem[] = [
  { id: 10, label: 'Ana Bastos', href: '/campanha/dobradinhas/10' },
]

const cell = (
  overrides: Partial<{
    direction: 'fromLeadership' | 'fromStateDeputy'
    items: RelationCellItem[]
    membershipAction: (
      state: CampaignFormActionState,
      formData: FormData,
    ) => Promise<CampaignFormActionState>
  }> = {},
) =>
  createElement(LeadershipStateDeputyRelationCell, {
    direction: overrides.direction ?? 'fromLeadership',
    fixedId: 7,
    ownerName: 'Maria Souza',
    items: overrides.items ?? items,
    options: OPTIONS,
    membershipAction: overrides.membershipAction ?? (async () => ({ status: 'success' as const })),
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

describe('leadership ↔ state deputy relation cell', () => {
  it('renders each item as a linked chip, with the party suffix when present', () => {
    render(
      cell({
        items: [
          { id: 10, label: 'Ana Bastos', href: '/campanha/dobradinhas/10' },
          { id: 11, label: 'Beto Lima', href: '/campanha/dobradinhas/11', party: 'PT' },
        ],
      }),
    )

    expect(screen.getByText('Ana Bastos')).toBeTruthy()
    expect(screen.getByText('Beto Lima (PT)')).toBeTruthy()
  })

  it('sends leadershipId/stateDeputyId/assigned=false, matching `fromLeadership`', async () => {
    const membershipAction = vi.fn(
      async (_state: CampaignFormActionState, _formData: FormData) =>
        ({ status: 'success' as const }) satisfies CampaignFormActionState,
    )
    render(cell({ direction: 'fromLeadership', membershipAction }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Bastos' }))

    await waitFor(() => expect(membershipAction).toHaveBeenCalledTimes(1))
    const formData = membershipAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('leadershipId')).toBe('7')
    expect(formData.get('stateDeputyId')).toBe('10')
    expect(formData.get('assigned')).toBe('false')
  })

  it('swaps the field the fixed id fills for `fromStateDeputy`', async () => {
    const membershipAction = vi.fn(
      async (_state: CampaignFormActionState, _formData: FormData) =>
        ({ status: 'success' as const }) satisfies CampaignFormActionState,
    )
    render(cell({ direction: 'fromStateDeputy', membershipAction }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Bastos' }))

    await waitFor(() => expect(membershipAction).toHaveBeenCalledTimes(1))
    const formData = membershipAction.mock.calls[0]?.[1] as FormData
    expect(formData.get('stateDeputyId')).toBe('7')
    expect(formData.get('leadershipId')).toBe('10')
  })

  it('adds a searched option and reports the live region as saved', async () => {
    render(cell())

    fireEvent.click(screen.getByRole('button', { name: 'Editar dobradinhas de Maria Souza' }))
    const dialog = await screen.findByRole('dialog')
    const searchInput = within(dialog).getByRole('combobox', { name: 'Buscar deputado estadual' })
    fireEvent.change(searchInput, { target: { value: 'Beto' } })

    fireEvent.click(await within(dialog).findByRole('option', { name: /Beto Lima/ }))

    await waitFor(() => expect(within(dialog).getByText('Beto Lima (PT)')).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Dobradinhas salvas.'))
  })

  it('shows the empty dash when there are no items yet', () => {
    render(cell({ items: [] }))
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('undoes a failed removal without reverting a sibling change from the same render', async () => {
    const membershipAction = vi.fn(
      async (
        _state: CampaignFormActionState,
        _formData: FormData,
      ): Promise<CampaignFormActionState> => ({
        message: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
      }),
    )
    render(cell({ membershipAction }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Bastos' }))
    })

    await waitFor(() => expect(screen.getByText('Ana Bastos')).toBeTruthy())
  })
})
