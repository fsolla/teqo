import { describe, expect, it } from 'vitest'

import { BRAZILIAN_PHONE_DUPLICATE_MESSAGE } from '@/lib/phone'
import { contactCreateSchema, contactFieldUpdateSchema } from '@/lib/schemas/contact'

describe('contactCreateSchema (C139)', () => {
  it('accepts a full valid ficha', () => {
    const result = contactCreateSchema.safeParse({
      name: 'Maria Silva',
      email: 'maria@example.com',
      phones: ['71999990000'],
      gender: 'feminino',
      state: 'BA',
      city: 'Salvador',
      postalCode: '40000000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts the minimal ficha (name + state)', () => {
    const result = contactCreateSchema.safeParse({ name: 'Ana Souza', state: 'BA' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing state', () => {
    const result = contactCreateSchema.safeParse({ name: 'Ana Souza' })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path[0] === 'state')).toBe(true)
  })

  it('rejects an unknown gender', () => {
    expect(
      contactCreateSchema.safeParse({ name: 'Ana Souza', state: 'BA', gender: 'x' }).success,
    ).toBe(false)
  })

  it('rejects a single-word name', () => {
    expect(contactCreateSchema.safeParse({ name: 'Ana', state: 'BA' }).success).toBe(false)
  })

  it('rejects duplicated phones within the same ficha (C112)', () => {
    const result = contactCreateSchema.safeParse({
      name: 'Ana Souza',
      state: 'BA',
      phones: ['71999990000', '71999990000'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === BRAZILIAN_PHONE_DUPLICATE_MESSAGE),
      ).toBe(true)
    }
  })

  it('accepts an empty phone list', () => {
    expect(
      contactCreateSchema.safeParse({ name: 'Ana Souza', state: 'BA', phones: [] }).success,
    ).toBe(true)
  })
})

describe('contactFieldUpdateSchema — C139 variants', () => {
  it('accepts the city variant', () => {
    expect(
      contactFieldUpdateSchema.safeParse({ id: 5, field: 'city', city: 'Camaçari' }).success,
    ).toBe(true)
    expect(contactFieldUpdateSchema.safeParse({ id: 5, field: 'city', city: 'C' }).success).toBe(
      false,
    )
  })

  it('transforms an empty postalCode to undefined (clear semantics)', () => {
    const result = contactFieldUpdateSchema.safeParse({
      id: 5,
      field: 'postalCode',
      postalCode: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const data = result.data as { field: string; postalCode?: string }
      expect(data.postalCode).toBeUndefined()
    }
  })

  it('accepts an 8-digit postalCode and rejects a malformed one', () => {
    expect(
      contactFieldUpdateSchema.safeParse({ id: 5, field: 'postalCode', postalCode: '42800000' })
        .success,
    ).toBe(true)
    expect(
      contactFieldUpdateSchema.safeParse({ id: 5, field: 'postalCode', postalCode: 'abc' }).success,
    ).toBe(false)
  })

  it('keeps the legacy variants working', () => {
    expect(
      contactFieldUpdateSchema.safeParse({ id: 5, field: 'name', name: 'Ana Souza' }).success,
    ).toBe(true)
    expect(
      contactFieldUpdateSchema.safeParse({ id: 5, field: 'phones', phones: ['71999990000'] })
        .success,
    ).toBe(true)
  })
})
