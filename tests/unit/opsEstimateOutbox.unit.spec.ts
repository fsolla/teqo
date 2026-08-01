import { describe, expect, it } from 'vitest'

import {
  collapseEstimateOutboxByPledge,
  resolveEstimateTransactionPledgeKey,
  toOpsEstimateOutboxRow,
} from '@/components/campaign/opsSync/opsEstimateOutboxModel'
import type { OfflineTransaction } from '@tanstack/offline-transactions'

const tx = (id: string, pledgeId: number, createdAtMs: number): OfflineTransaction =>
  ({
    id,
    mutationFnName: 'estimateVotes',
    mutations: [{ key: pledgeId } as OfflineTransaction['mutations'][number]],
    keys: [String(pledgeId)],
    idempotencyKey: id,
    createdAt: new Date(createdAtMs),
    retryCount: 0,
    nextAttemptAt: createdAtMs,
    metadata: { pledgeId },
    version: 1,
  }) as OfflineTransaction

describe('opsEstimateOutboxModel (OH6)', () => {
  it('collapses superseded transactions for the same pledge', () => {
    const collapsed = collapseEstimateOutboxByPledge([
      tx('a', 1, 1000),
      tx('b', 1, 3000),
      tx('c', 2, 2000),
      tx('d', 1, 2500),
    ])

    expect(collapsed.map((entry) => entry.id)).toEqual(['c', 'b'])
    expect(resolveEstimateTransactionPledgeKey(collapsed[1]!)).toBe('1')
  })

  it('builds a pending outbox row from an enqueue payload', () => {
    expect(
      toOpsEstimateOutboxRow({
        pledge: 9,
        estimatedVotes: { pessimistic: 1, central: 2, optimistic: 3 },
        estimateNote: 'nota',
        baseEstimatedAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toEqual({
      pledgeId: 9,
      estimatedVotes: { pessimistic: 1, central: 2, optimistic: 3 },
      estimateNote: 'nota',
      baseEstimatedAt: '2026-08-01T00:00:00.000Z',
      status: 'pending',
    })
  })
})
