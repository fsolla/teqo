import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

import { SpeechCutDeleteDialog } from '@/components/campaign/speech/SpeechCutDeleteDialog'

const fetchMock = vi.fn()
const jsonResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

const renderDialog = (overrides: Partial<Parameters<typeof SpeechCutDeleteDialog>[0]> = {}) => {
  render(
    <SpeechCutDeleteDialog cutId={123} status="published" publicPath="/corte/123" {...overrides} />,
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

describe('SpeechCutDeleteDialog (C183)', () => {
  it('warns about the public link only when the cut is published', async () => {
    renderDialog({ status: 'published', publicPath: '/corte/123' })
    const dialog = await openConfirm()

    expect(within(dialog).getByText('Apagar este corte?')).toBeDefined()
    expect(within(dialog).getByText('/corte/123')).toBeDefined()
    expect(within(dialog).getByText(/deixa de funcionar para quem já recebeu/)).toBeDefined()
  })

  it('keeps only the irreversible warning when the cut is not published', async () => {
    renderDialog({ status: 'unpublished', publicPath: '/corte/123' })
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
      '/campanha/comunicacao/acervo/cortes/123/apagar',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('redirects to the list after delete when asked (detail page)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', deleted: true }))
    renderDialog({ redirectTo: '/campanha/comunicacao/acervo/cortes' })
    await openConfirm()
    confirm()

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith('/campanha/comunicacao/acervo/cortes'),
    )
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })

  it('surfaces the domain error and does not refresh', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'error', message: 'Corte não encontrado.' }, false),
    )
    renderDialog()
    await openConfirm()
    confirm()

    expect(await screen.findByText('Corte não encontrado.')).toBeDefined()
    expect(routerMock.refresh).not.toHaveBeenCalled()
  })
})
