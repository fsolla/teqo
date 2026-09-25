// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { generateTextMock, deepSeekMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  deepSeekMock: vi.fn(() => 'mock-model'),
}))

vi.mock('ai', () => ({ generateText: generateTextMock }))
vi.mock('@ai-sdk/deepseek', () => ({ deepSeek: deepSeekMock }))

import { deriveDemandTitle } from '@/utilities/ai/campaignDemandTitle'

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
  generateTextMock.mockReset()
  deepSeekMock.mockClear()
})

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY
})

describe('deriveDemandTitle (B195)', () => {
  it('devolve o título quando o modelo responde algo usável', async () => {
    generateTextMock.mockResolvedValue({ text: 'Carro de som para a plenária' })

    await expect(deriveDemandTitle('preciso de carro de som', 'transporte')).resolves.toBe(
      'Carro de som para a plenária',
    )
  })

  it('degrada para null sem chave, em erro ou com saída inutilizável', async () => {
    delete process.env.DEEPSEEK_API_KEY
    await expect(deriveDemandTitle('pedido')).resolves.toBeNull()
    expect(generateTextMock).not.toHaveBeenCalled()

    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
    generateTextMock.mockRejectedValue(new Error('provider down'))
    await expect(deriveDemandTitle('pedido')).resolves.toBeNull()

    generateTextMock.mockResolvedValue({ text: '   ' })
    await expect(deriveDemandTitle('pedido')).resolves.toBeNull()
  })

  it('desliga o thinking e mantém teto de saída acima do orçamento de raciocínio', async () => {
    generateTextMock.mockResolvedValue({ text: 'Título curto' })

    await deriveDemandTitle('pedido qualquer', 'material')

    const call = generateTextMock.mock.calls[0]![0] as {
      maxOutputTokens?: number
      providerOptions?: unknown
    }
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: 'disabled' } } })
    expect(call.maxOutputTokens).toBeGreaterThanOrEqual(1000)
  })
})
