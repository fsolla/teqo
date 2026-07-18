// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  brazilianMobile,
  nullablePersistedEmail,
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
  optionalPersistedEmail,
} from '@/lib/schemas/primitives'

describe('persisted schema primitives', () => {
  it('accepts positive numeric relationship IDs but not numeric strings', () => {
    expect(positiveRelationshipId.parse(4)).toBe(4)
    expect(() => positiveRelationshipId.parse('4')).toThrow()
  })

  it('preserves optional and nullable trimmed text semantics', () => {
    expect(trimmedOptionalText(20).parse('  texto  ')).toBe('texto')
    expect(trimmedOptionalText(20).parse('   ')).toBeUndefined()
    expect(trimmedNullableText(20).parse('   ')).toBeNull()
    expect(trimmedNullableText(20).parse(null)).toBeNull()
    expect(trimmedNullableText(20).parse(undefined)).toBeUndefined()
  })

  it('normalizes Brazilian mobile phones and keeps email clearing semantics distinct', () => {
    expect(brazilianMobile.parse('(71) 99999-0000')).toBe('71999990000')
    expect(() => brazilianMobile.parse('7199990000')).toThrow('Celular brasileiro inválido.')
    expect(optionalPersistedEmail.parse('')).toBeUndefined()
    expect(nullablePersistedEmail.parse('')).toBeNull()
    expect(nullablePersistedEmail.parse(null)).toBeNull()
  })
})
