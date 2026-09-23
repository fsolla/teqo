// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { generateObjectMock, deepSeekMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  deepSeekMock: vi.fn(() => 'mock-model'),
}))

vi.mock('ai', () => ({ generateObject: generateObjectMock }))
vi.mock('@ai-sdk/deepseek', () => ({ deepSeek: deepSeekMock }))

import {
  expandContentPieceSearchTheme,
  expandSearchTheme,
  expandSpeechSearchTheme,
} from '@/utilities/ai/expandSpeechSearchTheme'

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

describe('expandSearchTheme (S28 — corpus)', () => {
  it('uses the public Central prompt for contentPiece and keeps the acervo prompt', async () => {
    generateObjectMock.mockResolvedValue({ object: { terms: ['escala 6x1'] } })

    await expandContentPieceSearchTheme('fim da escala')
    await expandSpeechSearchTheme('defesa do SUS')

    const publicCall = generateObjectMock.mock.calls[0]![0] as { system: string }
    const speechCall = generateObjectMock.mock.calls[1]![0] as { system: string }
    expect(publicCall.system).toContain('Central de Conteúdos')
    expect(publicCall.system).not.toContain('acervo de discursos')
    expect(speechCall.system).toContain('acervo de discursos')
    expect(speechCall.system).not.toContain('Central de Conteúdos')
  })

  it('shares the sanitization and the failure contract with the acervo', async () => {
    generateObjectMock.mockResolvedValue({ object: { terms: ['SUS%', 'saúde pública', 'sus'] } })

    await expect(expandSearchTheme('defesa do SUS', 'contentPiece')).resolves.toEqual({
      terms: ['SUS', 'saúde pública'],
    })

    delete process.env.DEEPSEEK_API_KEY
    await expect(expandSearchTheme('defesa do SUS', 'contentPiece')).resolves.toBeNull()
    expect(generateObjectMock).toHaveBeenCalledTimes(1)
  })
})
