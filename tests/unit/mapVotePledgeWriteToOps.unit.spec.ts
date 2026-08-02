import { describe, expect, it } from 'vitest'

import { mapVotePledgeWriteToOps } from '@/lib/campaignOps/mapVotePledgeWriteToOps'

describe('mapVotePledgeWriteToOps (OH7)', () => {
  it('maps a depth-0 write response into an OpsVotePledge row', () => {
    expect(
      mapVotePledgeWriteToOps({
        id: 10,
        leadership: 2,
        municipality: 1,
        declaredVotes: 120,
        declaredAt: '2026-08-01T10:00:00.000Z',
        declaredBy: 5,
        updatedAt: '2026-08-01T13:00:00.000Z',
        estimatedVotes: { pessimistic: 80, central: 100, optimistic: 120 },
        estimateNote: 'nota',
        estimatedBy: 5,
        estimatedAt: '2026-08-01T13:00:00.000Z',
      }),
    ).toEqual({
      id: 10,
      leadership: 2,
      municipality: 1,
      declaredVotes: 120,
      declaredAt: '2026-08-01T10:00:00.000Z',
      declaredBy: 5,
      updatedAt: '2026-08-01T13:00:00.000Z',
      estimatedVotes: { pessimistic: 80, central: 100, optimistic: 120 },
      estimateNote: 'nota',
      estimatedBy: 5,
      estimatedAt: '2026-08-01T13:00:00.000Z',
    })
  })
})
