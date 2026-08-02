import { describe, expect, it } from 'vitest'

import {
  collapseLeadershipUpdateOutbox,
  leadershipMembershipOutboxKey,
  stateDeputyMunicipalitiesOutboxKey,
} from '@/components/campaign/opsSync/opsDomainOutboxModel'
import type { OfflineTransaction } from '@tanstack/offline-transactions'

const tx = (
  id: string,
  leadershipId: number,
  createdAtMs: number,
): OfflineTransaction =>
  ({
    id,
    mutationFnName: 'updateLeadershipInternal',
    mutations: [{ key: leadershipId } as OfflineTransaction['mutations'][number]],
    keys: [String(leadershipId)],
    idempotencyKey: id,
    createdAt: new Date(createdAtMs),
    retryCount: 0,
    nextAttemptAt: createdAtMs,
    metadata: { leadershipId },
    version: 1,
  }) as OfflineTransaction

describe('opsDomainOutboxModel (OH13)', () => {
  it('collapses superseded leadership updates', () => {
    const collapsed = collapseLeadershipUpdateOutbox([
      tx('a', 1, 1000),
      tx('b', 1, 3000),
      tx('c', 2, 2000),
    ])

    expect(collapsed.map((entry) => entry.id)).toEqual(['c', 'b'])
  })

  it('builds stable membership and batch keys', () => {
    expect(leadershipMembershipOutboxKey('municipalities', 9, 3)).toBe('municipalities:9:3')
    expect(stateDeputyMunicipalitiesOutboxKey(4, [3, 1, 2], true)).toBe('4:add:1,2,3')
  })
})
