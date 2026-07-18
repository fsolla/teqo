// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const phoneMocks = vi.hoisted(() => ({
  normalizeBrazilianPhone: vi.fn<(value: string) => string | null>(),
}))

vi.mock('@/utilities/phone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/phone')>()
  phoneMocks.normalizeBrazilianPhone.mockImplementation(actual.normalizeBrazilianPhone)

  return {
    ...actual,
    normalizeBrazilianPhone: phoneMocks.normalizeBrazilianPhone,
  }
})

import { Contact } from '@/collections/Contact'
import { leadershipCreateSchema } from '@/lib/schemas/leadership'

const contactPhoneHook = Contact.hooks?.beforeValidate?.[0]

const runContactPhoneHook = async (phone: string) => {
  if (typeof contactPhoneHook !== 'function') {
    throw new Error('Expected Contact.beforeValidate phone hook.')
  }

  const data = { phone }
  await contactPhoneHook({ data } as never)
  return data.phone
}

describe('Contact phone normalization boundary', () => {
  beforeEach(() => {
    phoneMocks.normalizeBrazilianPhone.mockClear()
  })

  it('normalizes once before leadership dedupe and skips canonical Contact input', async () => {
    const parsed = leadershipCreateSchema.parse({
      nucleus: 1,
      name: 'Liderança normalizada',
      phone: '+55 (71) 99999-1234',
    })

    expect(parsed.phone).toBe('71999991234')
    expect(await runContactPhoneHook(parsed.phone)).toBe('71999991234')
    expect(phoneMocks.normalizeBrazilianPhone).toHaveBeenCalledTimes(1)
  })

  it('normalizes a formatted phone sent directly to the Contact API boundary', async () => {
    expect(await runContactPhoneHook('+55 (71) 99999-1234')).toBe('71999991234')
    expect(phoneMocks.normalizeBrazilianPhone).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid canonical-length direct API phone without re-normalizing it', async () => {
    await expect(runContactPhoneHook('00000000000')).rejects.toThrow(
      'Celular brasileiro inválido.',
    )
    expect(phoneMocks.normalizeBrazilianPhone).not.toHaveBeenCalled()
  })
})
