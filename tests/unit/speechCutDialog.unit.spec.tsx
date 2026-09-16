import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpeechCutDialog } from '@/components/campaign/speech/SpeechCutDialog'
import type { SpeechCutViewModel } from '@/lib/speechCut'

const SAVE_ENDPOINT = '/campanha/comunicacao/acervo/cortar'
const STATUS_ENDPOINT = `${SAVE_ENDPOINT}/status`
const SUGGESTION_ENDPOINT = `${SAVE_ENDPOINT}/sugestao`

const RANGE = { startSeconds: 43, endSeconds: 118 }

const cutView = (overrides: Partial<SpeechCutViewModel> = {}): SpeechCutViewModel => ({
  id: 123,
  status: 'processing',
  step: 'resolving',
  title: 'Acesso a medicamentos',
  description: 'Descrição do trecho',
  startSeconds: 43,
  endSeconds: 118,
  durationSeconds: 75,
  durationLabel: '1min15s',
  publicPath: '/corte/123',
  mediaUrl: null,
  mediaFilename: null,
  youtubeVideoId: null,
  publishedAt: null,
  failureMessage: null,
  ...overrides,
})

const jsonResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

const fetchMock = vi.fn()

const renderDialog = (overrides: Partial<Parameters<typeof SpeechCutDialog>[0]> = {}) => {
  const onPublished = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <SpeechCutDialog
      open
      onOpenChange={onOpenChange}
      speechId={42}
      speechType="BREVES COMUNICAÇÕES"
      dateLabel="11/08/2026"
      summary="Saúde e educação em Feira de Santana."
      range={RANGE}
      onPublished={onPublished}
      {...overrides}
    />,
  )
  return { onPublished, onOpenChange }
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('SpeechCutDialog (C167)', () => {
  it('pre-fills the deterministic fallback, then swaps in the AI suggestion on untouched fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'success',
        suggestion: { title: 'Acesso a medicamentos', description: 'Sugestão IA', source: 'ai' },
      }),
    )

    renderDialog()

    await screen.findByDisplayValue('Sugestão IA')
    expect(screen.getByDisplayValue('Acesso a medicamentos')).toBeTruthy()
    expect(screen.getByText(/Sugerido por IA/)).toBeTruthy()
  })

  it('never overwrites a field the user has already typed in', async () => {
    let resolveSuggestion!: (response: unknown) => void
    const suggestion = new Promise((resolve) => {
      resolveSuggestion = resolve
    })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(SUGGESTION_ENDPOINT)) return suggestion
      throw new Error(`unexpected fetch: ${String(input)}`)
    })

    renderDialog()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Meu título' } })

    resolveSuggestion(
      jsonResponse({
        status: 'success',
        suggestion: { title: 'Título da IA', description: 'Descrição da IA', source: 'ai' },
      }),
    )

    await screen.findByDisplayValue('Descrição da IA')
    expect(screen.getByDisplayValue('Meu título')).toBeTruthy()
    expect(screen.queryByDisplayValue('Título da IA')).toBeNull()
  })

  it('creates, follows the steps and hands the published cut to the caller', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith(SUGGESTION_ENDPOINT)) {
        return jsonResponse({
          status: 'success',
          suggestion: { title: 'Fallback', description: 'Fallback', source: 'fallback' },
        })
      }
      if (url.endsWith(SAVE_ENDPOINT)) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          speechId: 42,
          startSeconds: 43,
          endSeconds: 118,
        })
        return jsonResponse({ status: 'success', cut: cutView() })
      }
      if (url.endsWith(STATUS_ENDPOINT)) {
        return jsonResponse({
          status: 'success',
          cut: cutView({
            status: 'published',
            step: null,
            mediaUrl: '/api/media/file/corte-123-43-118.mp4',
            mediaFilename: 'corte-123-43-118.mp4',
          }),
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { onPublished, onOpenChange } = renderDialog()
    await screen.findByDisplayValue(/Trecho de BREVES COMUNICAÇÕES/)

    fireEvent.click(screen.getByRole('button', { name: /Cortar e publicar/ }))

    await screen.findByText('Preparando o corte…')
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(onPublished.mock.calls[0][0].publicPath).toBe('/corte/123')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the cause the row mapped instead of the generic failure line', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(SUGGESTION_ENDPOINT)) {
        return jsonResponse({
          status: 'success',
          suggestion: { title: 'Fallback', description: 'Fallback', source: 'fallback' },
        })
      }
      if (url.endsWith(SAVE_ENDPOINT)) {
        return jsonResponse({ status: 'success', cut: cutView() })
      }
      if (url.endsWith(STATUS_ENDPOINT)) {
        return jsonResponse({
          status: 'success',
          cut: cutView({
            status: 'failed',
            step: null,
            failureMessage: 'A Câmara ainda está gerando o vídeo deste trecho.',
          }),
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    renderDialog()
    await screen.findByDisplayValue(/Trecho de BREVES COMUNICAÇÕES/)
    fireEvent.click(screen.getByRole('button', { name: /Cortar e publicar/ }))

    await screen.findByText(
      'A Câmara ainda está gerando o vídeo deste trecho.',
      {},
      { timeout: 4000 },
    )
    expect(screen.queryByText(/A Câmara não está entregando o vídeo desta fala agora/)).toBeNull()
  })

  it('shows the honest failure and retries the same row (no duplicate create)', async () => {
    const retryBodies: unknown[] = []
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith(SUGGESTION_ENDPOINT)) {
        return jsonResponse({
          status: 'success',
          suggestion: { title: 'Fallback', description: 'Fallback', source: 'fallback' },
        })
      }
      if (url.endsWith(SAVE_ENDPOINT)) {
        retryBodies.push(JSON.parse(String(init?.body)))
        return jsonResponse({ status: 'success', cut: cutView() })
      }
      if (url.endsWith(STATUS_ENDPOINT)) {
        return jsonResponse({ status: 'success', cut: cutView({ status: 'failed', step: null }) })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    renderDialog()
    await screen.findByDisplayValue(/Trecho de BREVES COMUNICAÇÕES/)
    fireEvent.click(screen.getByRole('button', { name: /Cortar e publicar/ }))

    const retry = await screen.findByRole('button', { name: 'Tentar novamente' }, { timeout: 4000 })
    fireEvent.click(retry)

    await waitFor(() => expect(retryBodies).toHaveLength(2))
    expect(retryBodies[1]).toEqual({ retryOf: 123 })
  })
})
