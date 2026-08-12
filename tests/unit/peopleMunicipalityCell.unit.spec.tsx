import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { PeopleMunicipalityCell } from '@/components/campaign/people/PeopleMunicipalityCell'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

vi.mock('@/app/(campaign)/campanha/actions/person', () => ({
  getPersonCapacityExitManifestAction: vi.fn(),
}))

import { getPersonCapacityExitManifestAction } from '@/app/(campaign)/campanha/actions/person'

vi.mock('sonner', () => ({
  toast: {
    success: () => {},
    error: () => {},
  },
}))

const INDEX: MunicipalityPortfolioIndexEntry[] = [
  { id: 1, slug: 'ilheus' },
  { id: 2, slug: 'itabuna' },
]

const manifestAction = vi.mocked(getPersonCapacityExitManifestAction)

let commitCalls: FormData[] = []

const success = async (): Promise<CampaignFormActionState> => ({ status: 'success' })

const cell = (
  props: Partial<Parameters<typeof PeopleMunicipalityCell>[0]> & {
    municipalityIds: number[]
  },
) =>
  createElement(PeopleMunicipalityCell, {
    ownerId: null,
    ownerName: 'Maria Souza',
    contactId: 42,
    municipalityIndex: INDEX,
    commitAction: async (_state: CampaignFormActionState, formData: FormData) => {
      commitCalls.push(formData)
      return success()
    },
    drawerTitle: 'Editar municípios',
    updateErrorMessage: 'Não foi possível atualizar os municípios.',
    ...props,
  })

const formEntry = (formData: FormData, name: string): string | null => {
  const value = formData.get(name)
  return typeof value === 'string' ? value : null
}

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
  commitCalls = []
  manifestAction.mockReset()
  cleanup()
})

afterAll(() => vi.unstubAllGlobals())

describe('C128 — people municipality cell lifecycle', () => {
  it('commits an ADDITION with a null owner, carrying the contactId (C116 assessora bug fix)', async () => {
    render(cell({ municipalityIds: [] }))

    const search = screen.getByRole('combobox', {
      name: 'Buscar município, território de identidade ou zona eleitoral',
    })
    fireEvent.change(search, { target: { value: 'Itabuna' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /Itabuna/ }))
      await Promise.resolve()
    })

    await waitFor(() => expect(commitCalls).toHaveLength(1), { timeout: 5000 })
    const formData = commitCalls[0]!
    expect(formEntry(formData, 'contactId')).toBe('42')
    expect(formEntry(formData, 'ownerId')).toBe('null')
    expect(formData.getAll('municipalityIds')).toEqual(['2'])
  })

  it('pauses the LAST removal behind the confirmation dialog and aborts on cancel', async () => {
    manifestAction.mockResolvedValue({
      capacity: 'account',
      accountName: 'Maria Souza',
      authored: { inviteCount: 0, updateCount: 0, feedCount: 0, importBatchCount: 0 },
      assessorado: { leadershipNames: [], deputyNames: [], activityNames: [] },
    })
    render(cell({ municipalityIds: [1], exitMode: 'account' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ilhéus' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Encerrar assessoria' })).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Encerrar assessoria' })).toBeNull(),
    )
    expect(commitCalls).toHaveLength(0)
    // The optimistic apply never happened — the chip is still there.
    expect(screen.getByText('Ilhéus')).toBeTruthy()
  })

  it('commits the LAST removal after the dialog confirms', async () => {
    manifestAction.mockResolvedValue({
      capacity: 'account',
      accountName: 'Maria Souza',
      authored: { inviteCount: 0, updateCount: 0, feedCount: 0, importBatchCount: 0 },
      assessorado: { leadershipNames: [], deputyNames: [], activityNames: [] },
    })
    render(cell({ municipalityIds: [1], exitMode: 'account' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ilhéus' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Encerrar assessoria' })).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar assessoria' }))

    await waitFor(() => expect(commitCalls).toHaveLength(1), { timeout: 5000 })
    expect(formEntry(commitCalls[0]!, 'contactId')).toBe('42')
    expect(formEntry(commitCalls[0]!, 'assigned')).toBe('false')
  })

  it('skips the dialog for a leadership with nothing to lose', async () => {
    manifestAction.mockResolvedValue({
      capacity: 'leadership',
      declaredVoteCount: 0,
      inviteCount: 0,
      municipalityNames: ['Ilhéus'],
    })
    render(cell({ municipalityIds: [1], exitMode: 'leadership' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ilhéus' }))

    await waitFor(() => expect(commitCalls).toHaveLength(1), { timeout: 5000 })
    expect(screen.queryByRole('heading', { name: 'Encerrar liderança' })).toBeNull()
  })

  it('skips the dialog for a stateDeputy exit (auto-cleanup)', async () => {
    render(cell({ municipalityIds: [1], exitMode: 'stateDeputy' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ilhéus' }))

    await waitFor(() => expect(commitCalls).toHaveLength(1), { timeout: 5000 })
    expect(manifestAction).not.toHaveBeenCalled()
  })

  it('aborts the commit when the manifest fails (fail-closed)', async () => {
    manifestAction.mockRejectedValue(new Error('Não foi possível carregar o que será encerrado.'))
    render(cell({ municipalityIds: [1], exitMode: 'account' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ilhéus' }))

    await waitFor(() => expect(manifestAction).toHaveBeenCalled())
    expect(commitCalls).toHaveLength(0)
    expect(screen.getByText('Ilhéus')).toBeTruthy()
  })
})
