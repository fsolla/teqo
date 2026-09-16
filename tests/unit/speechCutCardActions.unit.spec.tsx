import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

import { SpeechCutLibraryCardActions } from '@/components/campaign/speech/SpeechCutLibraryCardActions'
import type { SpeechCutLibraryItemViewModel, SpeechCutStatus } from '@/lib/speechCut'

const cutView = (
  status: SpeechCutStatus,
  overrides: Partial<SpeechCutLibraryItemViewModel> = {},
): SpeechCutLibraryItemViewModel => ({
  id: 7,
  status,
  step: null,
  title: 'Corte da biblioteca',
  description: 'Descrição do corte',
  startSeconds: 0,
  endSeconds: 20,
  durationSeconds: 20,
  durationLabel: '20s',
  publicPath: '/corte/7',
  mediaUrl: null,
  mediaFilename: null,
  youtubeVideoId: null,
  publishedAt: null,
  failureMessage: status === 'failed' ? 'Não foi possível preparar o corte.' : null,
  createdAtLabel: '16 set. 2026',
  origin: null,
  ...overrides,
})

const fetchMock = vi.fn()
const jsonResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

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
  routerMock.refresh.mockReset()
  fetchMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SpeechCutLibraryCardActions (C183)', () => {
  it('offers retry only on a failed cut and always offers delete', () => {
    const { unmount } = render(<SpeechCutLibraryCardActions cut={cutView('failed')} />)
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeDefined()
    unmount()

    render(<SpeechCutLibraryCardActions cut={cutView('published')} />)
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeDefined()
  })

  it('keeps delete available while the cut is still processing', () => {
    render(<SpeechCutLibraryCardActions cut={cutView('processing')} />)
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeDefined()
  })

  it('retries through the cut endpoint on the same row', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'success', cut: { id: 7 } }))
    render(<SpeechCutLibraryCardActions cut={cutView('failed')} />)

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/campanha/comunicacao/acervo/cortes/7/retry',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ cutId: 7 }) }),
    )
  })
})
