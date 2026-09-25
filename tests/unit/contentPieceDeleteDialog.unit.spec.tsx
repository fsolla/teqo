import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

import { ContentPieceDeleteDialog } from '@/components/campaign/content/ContentPieceDeleteDialog'

const fetchMock = vi.fn()
const jsonResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

const renderDialog = (overrides: Partial<Parameters<typeof ContentPieceDeleteDialog>[0]> = {}) => {
  render(
    <ContentPieceDeleteDialog
      contentPieceId={321}
      status="publicado"
      publicPath="/conteudos/fim-da-escala-6x1"
      {...overrides}
    />,
  )
}

const openConfirm = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Apagar' })[0]!)
  return screen.findByRole('alertdialog')
}

const confirm = () =>
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Apagar' }))

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

describe('ContentPieceDeleteDialog (C222)', () => {
  it('names the public link only when the published piece has a slug', async () => {
    renderDialog({ status: 'publicado', publicPath: '/conteudos/fim-da-escala-6x1' })
    const dialog = await openConfirm()

    expect(within(dialog).getByText('Apagar esta peça?')).toBeDefined()
    expect(within(dialog).getByText('/conteudos/fim-da-escala-6x1')).toBeDefined()
    expect(within(dialog).getByText(/deixa de funcionar para quem já recebeu/)).toBeDefined()
  })

  it('keeps only the irreversible warning on a draft', async () => {
    renderDialog({ status: 'rascunho', publicPath: null })
    const dialog = await openConfirm()

    expect(within(dialog).getByText('Esta ação não pode ser desfeita.')).toBeDefined()
    expect(within(dialog).queryByText(/deixa de funcionar/)).toBeNull()
  })

  it('does not name a link when the piece has no public path', async () => {
    renderDialog({ status: 'publicado', publicPath: null })
    const dialog = await openConfirm()

    expect(within(dialog).getByText('Esta ação não pode ser desfeita.')).toBeDefined()
    expect(within(dialog).queryByText(/deixa de funcionar/)).toBeNull()
  })

  it('deletes on the right endpoint and refreshes the list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', deleted: true }))
    renderDialog()
    await openConfirm()
    confirm()

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/campanha/comunicacao/conteudos/321/apagar',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('redirects to the list after delete when asked (ficha)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', deleted: true }))
    renderDialog({ redirectTo: '/campanha/comunicacao/conteudos' })
    await openConfirm()
    confirm()

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith('/campanha/comunicacao/conteudos'),
    )
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })

  it('surfaces the domain error and does not refresh', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'error', message: 'Peça não encontrada.' }, false),
    )
    renderDialog()
    await openConfirm()
    confirm()

    expect(await screen.findByText('Peça não encontrada.')).toBeDefined()
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })
})
