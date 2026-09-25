// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { generateObjectMock, deepSeekMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  deepSeekMock: vi.fn(() => 'mock-model'),
}))

vi.mock('ai', () => ({ generateObject: generateObjectMock }))
vi.mock('@ai-sdk/deepseek', () => ({ deepSeek: deepSeekMock }))

import { suggestSpeechCutMetadata } from '@/utilities/speech/speechCutMetadata'

const segments = [
  { startSeconds: 0, endSeconds: 12, text: 'A saúde pública precisa de mais investimento.' },
]

const suggest = (overrides: Partial<Parameters<typeof suggestSpeechCutMetadata>[0]> = {}) =>
  suggestSpeechCutMetadata({
    speechType: 'Discurso',
    dateLabel: '07/02/2023',
    summary: 'Saúde e educação em Feira de Santana.',
    segments,
    startSeconds: 0,
    endSeconds: 12,
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

describe('suggestSpeechCutMetadata (C167)', () => {
  it('devolve a sugestão da IA validada', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        title: 'Mais investimento na saúde',
        description: 'Solla defende a atenção básica.',
      },
    })

    await expect(suggest()).resolves.toEqual({
      title: 'Mais investimento na saúde',
      description: 'Solla defende a atenção básica.',
      source: 'ai',
    })
  })

  it('degrada para o fallback sem chave, sem trecho ou em erro do provedor', async () => {
    delete process.env.DEEPSEEK_API_KEY
    await expect(suggest()).resolves.toMatchObject({ source: 'fallback' })
    expect(generateObjectMock).not.toHaveBeenCalled()

    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
    await expect(suggest({ segments: [] })).resolves.toMatchObject({ source: 'fallback' })
    expect(generateObjectMock).not.toHaveBeenCalled()

    generateObjectMock.mockRejectedValue(new Error('provider down'))
    await expect(suggest()).resolves.toMatchObject({ source: 'fallback' })
  })

  it('desliga o thinking e mantém teto de saída acima do orçamento de raciocínio', async () => {
    generateObjectMock.mockResolvedValue({ object: { title: 'Título', description: 'Descrição' } })

    await suggest()

    const call = generateObjectMock.mock.calls[0]![0] as {
      maxOutputTokens?: number
      providerOptions?: unknown
    }
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: 'disabled' } } })
    expect(call.maxOutputTokens).toBeGreaterThanOrEqual(1000)
  })
})
