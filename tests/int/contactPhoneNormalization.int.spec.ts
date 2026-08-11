// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const phoneMocks = vi.hoisted(() => ({
  normalizeBrazilianPhone: vi.fn<(value: string) => string | null>(),
}))

vi.mock('@/lib/phone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/phone')>()
  phoneMocks.normalizeBrazilianPhone.mockImplementation(actual.normalizeBrazilianPhone)

  return {
    ...actual,
    normalizeBrazilianPhone: phoneMocks.normalizeBrazilianPhone,
  }
})

import { Contact } from '@/collections/Contact'
import { leadershipCreateSchema } from '@/lib/schemas/leadership'

import { stub } from '../helpers/stub'

const contactPhoneHook = Contact.hooks?.beforeValidate?.[0]

type ContactPhoneHookArgs = Parameters<NonNullable<typeof contactPhoneHook>>[0]

const runContactPhoneHook = async (phones: unknown) => {
  if (typeof contactPhoneHook !== 'function') {
    throw new Error('Expected Contact.beforeValidate phone hook.')
  }

  const data: { phones?: unknown } = { phones }
  await contactPhoneHook(stub<ContactPhoneHookArgs>({ data }))
  return data.phones
}

describe('Contact phone normalization boundary', () => {
  beforeEach(() => {
    phoneMocks.normalizeBrazilianPhone.mockClear()
  })

  it('normalizes once before leadership dedupe and skips canonical Contact input', async () => {
    const parsed = leadershipCreateSchema.parse({
      municipalities: [1],
      name: 'Liderança normalizada',
      phones: ['+55 (71) 99999-1234'],
    })

    expect(parsed.phones).toEqual(['71999991234'])
    expect(await runContactPhoneHook([{ value: parsed.phones[0] }])).toEqual([
      { value: '71999991234' },
    ])
    expect(phoneMocks.normalizeBrazilianPhone).toHaveBeenCalledTimes(1)
  })

  it('normalizes a formatted phone sent directly to the Contact API boundary', async () => {
    expect(await runContactPhoneHook([{ value: '+55 (71) 99999-1234' }])).toEqual([
      { value: '71999991234' },
    ])
    expect(phoneMocks.normalizeBrazilianPhone).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid canonical-length direct API phone without re-normalizing it', async () => {
    await expect(runContactPhoneHook([{ value: '00000000000' }])).rejects.toThrow(
      'Celular brasileiro inválido.',
    )
    expect(phoneMocks.normalizeBrazilianPhone).not.toHaveBeenCalled()
  })

  it('drops empty entries and rejects a duplicate within the same ficha', async () => {
    expect(await runContactPhoneHook([{ value: '' }, { value: null }])).toEqual([])

    await expect(
      runContactPhoneHook([{ value: '71999991234' }, { value: '71999991234' }]),
    ).rejects.toThrow('Telefone repetido na ficha.')
  })
})
