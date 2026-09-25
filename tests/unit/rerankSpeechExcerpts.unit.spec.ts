import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { generateObjectMock, deepSeekMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  deepSeekMock: vi.fn(() => 'mock-model'),
}))

vi.mock('ai', () => ({ generateObject: generateObjectMock }))
vi.mock('@ai-sdk/deepseek', () => ({ deepSeek: deepSeekMock }))

import {
  rerankSpeechExcerpts,
  type SpeechExcerptRerankCandidate,
} from '@/utilities/ai/rerankSpeechExcerpts'

const candidate = (index: number): SpeechExcerptRerankCandidate => ({
  index,
  dateLabel: '07/02/2023 · 17:28',
  durationSeconds: 20,
  citation: 'A saúde pública baiana',
})

const candidates = [candidate(0), candidate(1), candidate(2)]

const rerank = (overrides: Partial<Parameters<typeof rerankSpeechExcerpts>[0]> = {}) =>
  rerankSpeechExcerpts({
    intencao: 'reels curto sobre o hospital do subúrbio',
    tema: 'hospital do subúrbio',
    candidates,
    limit: 3,
    ...overrides,
  })

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
  generateObjectMock.mockReset()
  deepSeekMock.mockClear()
})

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY
})

describe('rerankSpeechExcerpts (C158)', () => {
  it('filtra índices fora do pool/duplicados e normaliza o motivo', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        choices: [
          { index: 0, reason: '  Cita o hospital e fecha a ideia  ' },
          { index: 9, reason: 'fora do pool' },
          { index: 0, reason: 'duplicado' },
          { index: 2, reason: 'ok' },
        ],
      },
    })

    await expect(rerank()).resolves.toEqual({
      choices: [
        { index: 0, reason: 'Cita o hospital e fecha a ideia' },
        { index: 2, reason: 'ok' },
      ],
    })
  })

  it('respeita o limite de escolhas', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        choices: [
          { index: 0, reason: 'a' },
          { index: 1, reason: 'b' },
          { index: 2, reason: 'c' },
        ],
      },
    })

    await expect(rerank({ limit: 1 })).resolves.toEqual({
      choices: [{ index: 0, reason: 'a' }],
    })
  })

  it('honra a lista vazia como decisão ("nenhum serve")', async () => {
    generateObjectMock.mockResolvedValue({ object: { choices: [] } })

    await expect(rerank()).resolves.toEqual({ choices: [] })
  })

  it('devolve null quando todos os motivos vêm vazios ou os índices são inválidos', async () => {
    generateObjectMock.mockResolvedValue({
      object: { choices: [{ index: 0, reason: '   ' }] },
    })

    await expect(rerank()).resolves.toBeNull()
  })

  it('corta o motivo em 140 caracteres', async () => {
    generateObjectMock.mockResolvedValue({
      object: { choices: [{ index: 1, reason: 'x'.repeat(500) }] },
    })

    const result = await rerank()
    expect(result?.choices[0]!.reason).toHaveLength(140)
  })

  it('curto-circuita sem chave, sem pool ou em erro do provedor — nunca lança', async () => {
    await expect(rerank({ candidates: [] })).resolves.toBeNull()
    expect(generateObjectMock).not.toHaveBeenCalled()

    delete process.env.DEEPSEEK_API_KEY
    await expect(rerank()).resolves.toBeNull()
    expect(generateObjectMock).not.toHaveBeenCalled()

    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
    generateObjectMock.mockRejectedValue(new Error('provider down'))
    await expect(rerank()).resolves.toBeNull()
  })

  it('envia intenção, tema e citações truncadas ao modelo', async () => {
    generateObjectMock.mockResolvedValue({ object: { choices: [{ index: 0, reason: 'ok' }] } })

    await rerank({ candidates: [candidate(0), { ...candidate(1), citation: 'y'.repeat(900) }] })

    const call = generateObjectMock.mock.calls[0]![0] as { prompt: string; abortSignal: unknown }
    expect(call.prompt).toContain('reels curto sobre o hospital do subúrbio')
    expect(call.prompt).toContain('Tema: hospital do subúrbio')
    expect(call.prompt).toContain('[0]')
    expect(call.prompt).not.toContain('y'.repeat(701))
    expect(call.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('desliga o thinking e mantém teto de saída acima do orçamento de raciocínio', async () => {
    generateObjectMock.mockResolvedValue({ object: { choices: [{ index: 0, reason: 'ok' }] } })

    await rerank()

    const call = generateObjectMock.mock.calls[0]![0] as {
      maxOutputTokens?: number
      providerOptions?: unknown
    }
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: 'disabled' } } })
    expect(call.maxOutputTokens).toBeGreaterThanOrEqual(1000)
  })
})
