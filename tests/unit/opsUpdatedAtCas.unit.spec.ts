import { describe, expect, it } from 'vitest'

import {
  assertOpsUpdatedAtCas,
  isOpsUpdatedAtConflictMessage,
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
  opsUpdatedAtConflictError,
  parseOpsUpdatedAtConflictServerUpdatedAt,
} from '@/lib/schemas/opsCas'

describe('opsUpdatedAtCas helpers (OH10)', () => {
  it('round-trips a stamped server updatedAt through the error message', () => {
    const stamped = opsUpdatedAtConflictError('2026-08-01T12:00:00.000Z')
    expect(isOpsUpdatedAtConflictMessage(stamped.message)).toBe(true)
    expect(parseOpsUpdatedAtConflictServerUpdatedAt(stamped.message)).toBe(
      '2026-08-01T12:00:00.000Z',
    )
  })

  it('keeps the bare conflict message exact for safeMessages matching', () => {
    expect(OPS_UPDATED_AT_CONFLICT_MESSAGE.length).toBeGreaterThan(10)
    expect(isOpsUpdatedAtConflictMessage(OPS_UPDATED_AT_CONFLICT_MESSAGE)).toBe(true)
    expect(parseOpsUpdatedAtConflictServerUpdatedAt(OPS_UPDATED_AT_CONFLICT_MESSAGE)).toBeNull()
  })

  it('rejects unrelated messages', () => {
    expect(isOpsUpdatedAtConflictMessage('outro erro')).toBe(false)
    expect(parseOpsUpdatedAtConflictServerUpdatedAt('outro erro')).toBeNull()
  })

  it('assertOpsUpdatedAtCas is a no-op without enforce or base', () => {
    expect(() => assertOpsUpdatedAtCas(false, '2026-08-01T12:00:00.000Z', 'other')).not.toThrow()
    expect(() => assertOpsUpdatedAtCas(true, undefined, 'other')).not.toThrow()
  })

  it('assertOpsUpdatedAtCas refuses a stale base', () => {
    expect(() =>
      assertOpsUpdatedAtCas(true, '2026-08-01T12:00:00.000Z', '2026-08-01T13:00:00.000Z'),
    ).toThrow(Error)
  })

  it('assertOpsUpdatedAtCas allows a matching base', () => {
    expect(() =>
      assertOpsUpdatedAtCas(true, '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z'),
    ).not.toThrow()
  })
})
