import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

import { ContentPieceBatchReceipt } from '@/components/campaign/content/ContentPieceBatchReceipt'
import { ContentPieceSelectionBar } from '@/components/campaign/content/ContentPieceSelectionBar'
import {
  ContentPieceCardSelectionFrame,
  ContentPieceRowCheckbox,
  ContentPieceSelectAllCheckbox,
  ContentPieceSelectionModeControl,
} from '@/components/campaign/content/ContentPieceSelectionControls'
import { ContentPieceSelectionProvider } from '@/components/campaign/content/ContentPieceSelectionProvider'
import { CAMPAIGN_CONTENT_PIECE_BATCH_HREF } from '@/lib/campaignPaths'
import type { ContentPieceSelectionRow } from '@/lib/contentPieceBatch'

const harnessRows = [
  { id: 1, title: 'Peça publicada', status: 'publicado', publicPath: '/conteudos/peca-publicada' },
  { id: 2, title: 'Peça em rascunho', status: 'rascunho', publicPath: null },
  { id: 3, title: 'Peça com falha', status: 'rascunho', publicPath: null },
] as const

const rows: ContentPieceSelectionRow[] = harnessRows.map(({ id, status, publicPath }) => ({
  id,
  status,
  publicPath,
}))

const fetchMock = vi.fn()
const jsonResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

const renderHarness = () => {
  render(
    <ContentPieceSelectionProvider rows={rows}>
      <ContentPieceSelectionModeControl />
      <ContentPieceBatchReceipt />
      <ContentPieceSelectAllCheckbox />
      {harnessRows.map((row) => (
        <ContentPieceRowCheckbox key={row.id} contentPieceId={row.id} title={row.title} />
      ))}
      <ContentPieceSelectionBar />
    </ContentPieceSelectionProvider>,
  )
}

const enterSelection = () => fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }))

const check = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }))

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

const openDeleteDialog = async () => {
  press('Apagar')
  return screen.findByRole('alertdialog')
}

const selectionStatus = () => screen.getByRole('status').textContent

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  routerMock.push.mockReset()
  routerMock.refresh.mockReset()
  fetchMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ContentPieceSelection (C236)', () => {
  it('enters selection mode opt-in, counts the selection and opens the bar only with one', () => {
    renderHarness()

    expect(screen.queryByText('Modo de seleção')).toBeNull()
    enterSelection()
    expect(screen.getByText('Modo de seleção')).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()

    check('Selecionar Peça publicada')
    expect(selectionStatus()).toContain('1 selecionada')

    check('Selecionar Peça em rascunho')
    expect(selectionStatus()).toContain('2 selecionadas')
  })

  it('selects and clears the whole visible page from the header checkbox', () => {
    renderHarness()
    enterSelection()

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as peças desta página' }),
    )
    expect(selectionStatus()).toContain('3 selecionadas')

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as peças desta página' }),
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('publishes the selection in one request, shows the receipt and clears the selection', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        outcome: { action: 'publicar', affected: 2, failures: [] },
      }),
    )
    renderHarness()
    enterSelection()
    check('Selecionar Peça em rascunho')
    check('Selecionar Peça com falha')

    press('Publicar')

    expect(await screen.findByText('2 peças publicadas')).toBeDefined()
    expect(fetchMock).toHaveBeenCalledWith(
      CAMPAIGN_CONTENT_PIECE_BATCH_HREF,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'publicar', contentPieceIds: [2, 3] }),
      }),
    )
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled())
    expect(screen.queryByText('2 selecionadas')).toBeNull()
    expect(screen.getByText('Modo de seleção')).toBeDefined()
  })

  it('keeps the selection and answers in the list when the whole request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error', message: 'Sessão expirada. Entre novamente.' }),
    })
    renderHarness()
    enterSelection()
    check('Selecionar Peça publicada')

    press('Publicar')

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Sessão expirada. Entre novamente.'),
    )
    expect(selectionStatus()).toContain('1 selecionada')
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })

  it('warns about the public links only when the selection carries published pieces', async () => {
    renderHarness()
    enterSelection()

    check('Selecionar Peça publicada')
    let dialog = await openDeleteDialog()
    expect(within(dialog).getByText('Apagar esta peça?')).toBeDefined()
    expect(within(dialog).getByText('/conteudos/peca-publicada')).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    check('Selecionar Peça em rascunho')
    dialog = await openDeleteDialog()
    expect(within(dialog).getByText('Apagar 2 peças selecionadas?')).toBeDefined()
    expect(within(dialog).getByText(/deixam de funcionar para quem já recebeu/)).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    check('Selecionar Peça publicada')
    check('Selecionar Peça com falha')
    dialog = await openDeleteDialog()
    expect(within(dialog).getByText('Apagar 2 peças selecionadas?')).toBeDefined()
    expect(within(dialog).getByText('Esta ação não pode ser desfeita.')).toBeDefined()
  })

  it('deletes the selection after the confirmation and names the partial failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        outcome: {
          action: 'apagar',
          affected: 2,
          failures: [{ contentPieceId: 3, message: 'Peça não encontrada.' }],
        },
      }),
    )
    renderHarness()
    enterSelection()
    check('Selecionar Peça em rascunho')
    check('Selecionar Peça com falha')

    const dialog = await openDeleteDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('2 de 3 peças apagadas. 1 falhou.'),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      CAMPAIGN_CONTENT_PIECE_BATCH_HREF,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'apagar', contentPieceIds: [2, 3] }),
      }),
    )
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled())
  })

  it('keeps the delete failure inside the dialog, with the selection intact', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'error', message: 'Peça não encontrada.' }, false),
    )
    renderHarness()
    enterSelection()
    check('Selecionar Peça publicada')
    check('Selecionar Peça em rascunho')

    const dialog = await openDeleteDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar' }))

    expect(await within(dialog).findByText('Peça não encontrada.')).toBeDefined()
    expect(screen.queryByText('2 de 3 peças apagadas. 1 falhou.')).toBeNull()
    expect(within(dialog).getByText('Apagar 2 peças selecionadas?')).toBeDefined()
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })

  it('leaves the selection mode from the top control', () => {
    renderHarness()
    enterSelection()
    check('Selecionar Peça publicada')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar seleção' }))

    expect(screen.queryByText('Modo de seleção')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'Selecionar' })).toBeDefined()
  })

  it('selects from the mobile card frame with the one shared state', () => {
    render(
      <ContentPieceSelectionProvider rows={rows}>
        <ContentPieceSelectionModeControl />
        <ContentPieceCardSelectionFrame
          contentPieceId={1}
          title="Peça publicada"
          header={<p>Peça publicada</p>}
        >
          <p>Corpo do card</p>
        </ContentPieceCardSelectionFrame>
        <ContentPieceSelectionBar />
      </ContentPieceSelectionProvider>,
    )

    // At rest the frame is the exact card, with no checkbox to scan past.
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Corpo do card')).toBeDefined()

    enterSelection()
    check('Selecionar Peça publicada')
    expect(selectionStatus()).toContain('1 selecionada')
  })
})
