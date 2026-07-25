// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  isPopulatedRelationship,
  relationshipId,
  requireRelationshipId,
} from '@/utilities/relationship'

describe('relationship primitives', () => {
  it('accepts only positive safe integer IDs from raw and populated relationships', () => {
    expect(relationshipId(7)).toBe(7)
    expect(relationshipId({ id: 11, name: 'Maria' })).toBe(11)

    for (const invalid of [NaN, Infinity, -Infinity, 1.5, 0, -1, '7', null]) {
      expect(relationshipId(invalid)).toBeNull()
      expect(isPopulatedRelationship({ id: invalid })).toBe(false)
    }
    expect(relationshipId(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    expect(relationshipId(Number.MAX_SAFE_INTEGER + 1)).toBeNull()
    expect(relationshipId({ id: Number.MAX_SAFE_INTEGER + 1 })).toBeNull()
  })

  it('requires a valid relationship with the caller message', () => {
    expect(requireRelationshipId({ id: 3 })).toBe(3)
    for (const invalid of [NaN, Infinity, 1.5, 0, -1, '3', { id: '3' }]) {
      expect(() => requireRelationshipId(invalid, 'Contato inválido.')).toThrow('Contato inválido.')
    }
  })

  it('narrows populated relationships without accepting malformed objects', () => {
    expect(isPopulatedRelationship({ id: 1, name: 'Ana' })).toBe(true)
    expect(isPopulatedRelationship(1)).toBe(false)
    expect(isPopulatedRelationship({ id: '1' })).toBe(false)
  })
})
