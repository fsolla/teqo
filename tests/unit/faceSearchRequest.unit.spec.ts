// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { FACE_SEARCH_DESCRIPTOR_LENGTH } from '@/lib/faceSearch'
import { faceSearchRequestSchema } from '@/lib/schemas/faceSearch'

// C234 — the wire contract of the selfie endpoint: strict object, exact
// descriptor length, finite numbers only and the two intents. Everything else
// is a malformed body (never a silently ignored field).

const vector = (): number[] => Array.from({ length: FACE_SEARCH_DESCRIPTOR_LENGTH }, () => 0.5)

describe('faceSearchRequestSchema', () => {
  it('accepts both intents with a full descriptor', () => {
    expect(faceSearchRequestSchema.safeParse({ vector: vector(), intent: 'search' }).success).toBe(
      true,
    )
    expect(
      faceSearchRequestSchema.safeParse({ vector: vector(), intent: 'leave-index' }).success,
    ).toBe(true)
  })

  it('rejects unknown intents and extra keys', () => {
    expect(faceSearchRequestSchema.safeParse({ vector: vector(), intent: 'enroll' }).success).toBe(
      false,
    )
    expect(
      faceSearchRequestSchema.safeParse({ vector: vector(), intent: 'search', image: 'x' }).success,
    ).toBe(false)
  })

  it('rejects descriptors of the wrong length or with non-finite values', () => {
    expect(
      faceSearchRequestSchema.safeParse({ vector: vector().slice(1), intent: 'search' }).success,
    ).toBe(false)
    expect(
      faceSearchRequestSchema.safeParse({
        vector: [...vector().slice(1), Number.NaN],
        intent: 'search',
      }).success,
    ).toBe(false)
    expect(
      faceSearchRequestSchema.safeParse({
        vector: [...vector().slice(1), Number.POSITIVE_INFINITY],
        intent: 'search',
      }).success,
    ).toBe(false)
    expect(faceSearchRequestSchema.safeParse({ vector: {}, intent: 'search' }).success).toBe(false)
    expect(faceSearchRequestSchema.safeParse({ intent: 'search' }).success).toBe(false)
  })
})
