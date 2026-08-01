import { describe, expect, it } from 'vitest'

import {
  isOpsEstimateConflictMessage,
  OPS_ESTIMATE_CONFLICT_MESSAGE,
  opsEstimateConflictError,
  parseOpsEstimateConflictServerEstimatedAt,
} from '@/lib/schemas/votePledge'

describe('opsEstimateConflict helpers (OH6)', () => {
  it('round-trips a stamped server estimatedAt through the error message', () => {
    const stamped = opsEstimateConflictError('2026-08-01T12:00:00.000Z')
    expect(isOpsEstimateConflictMessage(stamped.message)).toBe(true)
    expect(parseOpsEstimateConflictServerEstimatedAt(stamped.message)).toBe(
      '2026-08-01T12:00:00.000Z',
    )
  })

  it('keeps the bare conflict message exact for safeMessages matching', () => {
    const bare = opsEstimateConflictError(null)
    expect(bare.message).toBe(OPS_ESTIMATE_CONFLICT_MESSAGE)
    expect(parseOpsEstimateConflictServerEstimatedAt(bare.message)).toBeNull()
  })

  it('rejects unrelated messages', () => {
    expect(isOpsEstimateConflictMessage('outro erro')).toBe(false)
    expect(parseOpsEstimateConflictServerEstimatedAt('outro erro')).toBeNull()
  })
})
