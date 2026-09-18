// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { generateObjectMock, deepSeekMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  deepSeekMock: vi.fn(() => 'mock-model'),
}))

vi.mock('ai', () => ({ generateObject: generateObjectMock }))
vi.mock('@ai-sdk/deepseek', () => ({ deepSeek: deepSeekMock }))

import { expandSpeechSearchTheme } from '@/utilities/ai/expandSpeechSearchTheme'

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
  generateObjectMock.mockReset()
  deepSeekMock.mockClear()
})

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY
})

describe('expandSpeechSearchTheme (C192)', () => {
  it('returns the sanitized terms the model produced', async () => {
    generateObjectMock.mockResolvedValue({
      object: { terms: ['SUS%', 'saúde pública', 'sus', 'ab'] },
    })

    await expect(expandSpeechSearchTheme('defesa do SUS')).resolves.toEqual({
      terms: ['SUS', 'saúde pública'],
    })
  })

  it('honra a lista vazia como resposta legítima (não é indisponibilidade)', async () => {
    generateObjectMock.mockResolvedValue({ object: { terms: [] } })

    await expect(expandSpeechSearchTheme('tema qualquer')).resolves.toEqual({ terms: [] })
  })

  it('curto-circuita sem chave sem chamar o provedor', async () => {
    delete process.env.DEEPSEEK_API_KEY

    await expect(expandSpeechSearchTheme('SUS')).resolves.toBeNull()
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('curto-circuita um tema vazio', async () => {
    await expect(expandSpeechSearchTheme('   ')).resolves.toBeNull()
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('degrada para null em erro do provedor — nunca lança', async () => {
    generateObjectMock.mockRejectedValue(new Error('provider down'))

    await expect(expandSpeechSearchTheme('SUS')).resolves.toBeNull()
  })

  it('envia o tema e um abortSignal limitado ao modelo', async () => {
    generateObjectMock.mockResolvedValue({ object: { terms: ['SUS'] } })

    await expandSpeechSearchTheme('defesa do SUS')

    const call = generateObjectMock.mock.calls[0]![0] as { prompt: string; abortSignal: unknown }
    expect(call.prompt).toBe('defesa do SUS')
    expect(call.abortSignal).toBeInstanceOf(AbortSignal)
  })
})
