import { describe, expect, it } from 'vitest'

import {
  createEmptyOpsSnapshot,
  opsOutboxKey,
  parseOpsSnapshot,
  serializeOpsSnapshot,
  type OpsActivity,
  type OpsCollectionKey,
  type OpsDemand,
  type OpsGoals,
  type OpsLeadership,
  type OpsLeadershipContact,
  type OpsMunicipality,
  type OpsMunicipalityUpdate,
  type OpsOrganization,
  type OpsSnapshot,
  type OpsStateDeputy,
  type OpsVoteEstimateScenarioFields,
  type OpsVotePledge,
  type OpsVotePledgeLeaderView,
} from '@/lib/campaignOps/opsContract'
import { resolveOpsHybridEnabled } from '@/lib/campaignOps/opsHybridFlag'
import { diffOpsIds, mergeOpsSnapshot, type OpsCollectionIdDiff } from '@/lib/campaignOps/opsMerge'
import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'
import type { OpsSyncState, OpsSyncStatus } from '@/lib/campaignOps/opsSyncMeta'

const municipality = (
  partial: Partial<OpsMunicipality> & Pick<OpsMunicipality, 'id' | 'slug'>,
): OpsMunicipality => ({
  name: partial.slug,
  kind: 'municipio',
  city: partial.slug,
  region: 'Região',
  ibgeCode: '0000000',
  updatedAt: '2026-08-01T12:00:00.000Z',
  ...partial,
})

const pledge = (partial: Partial<OpsVotePledge> & Pick<OpsVotePledge, 'id'>): OpsVotePledge => ({
  leadership: 1,
  municipality: 1,
  declaredVotes: 100,
  updatedAt: '2026-08-01T12:00:00.000Z',
  ...partial,
})

const snapshot = (partial: Partial<OpsSnapshot> = {}): OpsSnapshot => ({
  ...createEmptyOpsSnapshot('2026-08-01T12:00:00.000Z'),
  ...partial,
})

describe('OPS_MIRROR_SCHEMA_VERSION', () => {
  it('is pinned at 1', () => {
    expect(OPS_MIRROR_SCHEMA_VERSION).toBe(1)
  })
})

describe('contract surface (knip + OH4 consumers)', () => {
  it('exports DTO and sync meta types for downstream issues', () => {
    const collectionKey: OpsCollectionKey = 'municipalities'
    const estimate: OpsVoteEstimateScenarioFields = { central: 1 }
    const contact: OpsLeadershipContact = { id: 1, name: 'Test' }
    const leadership: OpsLeadership = {
      id: 1,
      contact,
      municipalities: [1],
      supportStatus: 'engajado',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }
    const activity: OpsActivity = {
      id: 1,
      title: 'A',
      slug: 'a',
      kind: 'caminhada',
      status: 'planejado',
      municipality: 1,
      updatedAt: '2026-08-01T12:00:00.000Z',
    }
    const stateDeputy: OpsStateDeputy = {
      id: 1,
      name: 'D',
      slug: 'd',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }
    const organization: OpsOrganization = {
      id: 1,
      name: 'O',
      slug: 'o',
      kind: 'sindicato',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }
    const demand: OpsDemand = {
      id: 1,
      title: 'D',
      slug: 'd',
      kind: 'material',
      municipality: 1,
      status: 'aberta',
      updatedAt: '2026-08-01T12:00:00.000Z',
    }
    const update: OpsMunicipalityUpdate = {
      id: 1,
      municipality: 1,
      author: 1,
      kind: 'nota',
      updatedAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-08-01T12:00:00.000Z',
    }
    const goals: OpsGoals = { stateGoal: 100_000 }
    const idDiff: OpsCollectionIdDiff = { added: [], removed: [] }
    const syncStatus: OpsSyncStatus = 'idle'
    const syncState: OpsSyncState = { status: syncStatus, lastSyncedAt: null }

    expect(collectionKey).toBe('municipalities')
    expect(estimate.central).toBe(1)
    expect(leadership.contact.name).toBe('Test')
    expect(activity.slug).toBe('a')
    expect(stateDeputy.slug).toBe('d')
    expect(organization.kind).toBe('sindicato')
    expect(demand.status).toBe('aberta')
    expect(update.kind).toBe('nota')
    expect(goals.stateGoal).toBe(100_000)
    expect(idDiff.added).toEqual([])
    expect(syncState.status).toBe('idle')
  })
})

describe('resolveOpsHybridEnabled', () => {
  it.each([
    ['1', true],
    ['true', true],
    ['0', false],
    ['false', false],
    ['', false],
    [undefined, false],
    ['yes', false],
  ] as const)('parses OPS_HYBRID=%j as %s', (value, expected) => {
    expect(resolveOpsHybridEnabled({ OPS_HYBRID: value })).toBe(expected)
  })
})

describe('OpsVotePledgeLeaderView', () => {
  it('excludes staff-only estimate fields at the type level', () => {
    const leaderView: OpsVotePledgeLeaderView = {
      id: 1,
      leadership: 2,
      municipality: 3,
      declaredVotes: 50,
      declaredAt: '2026-08-01T10:00:00.000Z',
      declaredBy: 4,
      updatedAt: '2026-08-01T12:00:00.000Z',
    }

    expect(leaderView).not.toHaveProperty('estimatedVotes')
    expect(leaderView).not.toHaveProperty('estimateNote')
    expect(leaderView).not.toHaveProperty('estimatedBy')
    expect(leaderView).not.toHaveProperty('estimatedAt')
  })
})

describe('serializeOpsSnapshot / parseOpsSnapshot', () => {
  it('round-trips ISO date strings unchanged', () => {
    const original = snapshot({
      revisedAt: '2026-08-01T15:30:45.123Z',
      municipalities: [
        municipality({
          id: 1,
          slug: 'itabuna',
          lastUpdateAt: '2026-07-30T08:00:00.000Z',
          updatedAt: '2026-08-01T09:00:00.000Z',
        }),
      ],
      votePledges: [
        pledge({
          id: 10,
          declaredAt: '2026-08-01T10:00:00.000Z',
          estimatedAt: '2026-08-01T11:00:00.000Z',
        }),
      ],
    })

    const parsed = parseOpsSnapshot(serializeOpsSnapshot(original))

    expect(parsed.revisedAt).toBe('2026-08-01T15:30:45.123Z')
    expect(parsed.municipalities[0]?.lastUpdateAt).toBe('2026-07-30T08:00:00.000Z')
    expect(parsed.votePledges[0]?.estimatedAt).toBe('2026-08-01T11:00:00.000Z')
  })
})

describe('mergeOpsSnapshot', () => {
  it('keeps the local row when the id is pending in the outbox', () => {
    const local = snapshot({
      votePledges: [
        pledge({
          id: 1,
          declaredVotes: 200,
          estimatedVotes: { central: 250, pessimistic: null, optimistic: null },
          estimatedAt: '2026-08-01T10:00:00.000Z',
        }),
      ],
    })
    const incoming = snapshot({
      revisedAt: '2026-08-01T13:00:00.000Z',
      votePledges: [
        pledge({
          id: 1,
          declaredVotes: 100,
          estimatedVotes: { central: 120, pessimistic: null, optimistic: null },
          estimatedAt: '2026-08-01T12:00:00.000Z',
        }),
      ],
    })

    const merged = mergeOpsSnapshot(local, incoming, new Set([opsOutboxKey('votePledges', 1)]))

    expect(merged.votePledges).toEqual(local.votePledges)
    expect(merged.revisedAt).toBe(incoming.revisedAt)
  })

  it('keeps the local row when the id is in conflict in the outbox', () => {
    const local = snapshot({
      municipalities: [
        municipality({
          id: 5,
          slug: 'cairu',
          name: 'Local name',
          updatedAt: '2026-08-01T10:00:00.000Z',
        }),
      ],
    })
    const incoming = snapshot({
      municipalities: [
        municipality({
          id: 5,
          slug: 'cairu',
          name: 'Server name',
          updatedAt: '2026-08-01T12:00:00.000Z',
        }),
      ],
    })

    const merged = mergeOpsSnapshot(local, incoming, new Set([opsOutboxKey('municipalities', 5)]))

    expect(merged.municipalities[0]?.name).toBe('Local name')
  })

  it('replaces rows outside the outbox and removes rows absent from incoming', () => {
    const local = snapshot({
      municipalities: [
        municipality({ id: 1, slug: 'itabuna', name: 'Old Itabuna' }),
        municipality({ id: 2, slug: 'cairu', name: 'Cairu' }),
      ],
      votePledges: [pledge({ id: 10, declaredVotes: 50 })],
    })
    const incoming = snapshot({
      municipalities: [
        municipality({ id: 1, slug: 'itabuna', name: 'New Itabuna' }),
        municipality({ id: 3, slug: 'valenca', name: 'Valença' }),
      ],
      votePledges: [pledge({ id: 11, declaredVotes: 80 })],
    })

    const merged = mergeOpsSnapshot(local, incoming, new Set())

    expect(merged.municipalities.map((row) => row.id)).toEqual([1, 3])
    expect(merged.municipalities[0]?.name).toBe('New Itabuna')
    expect(merged.votePledges.map((row) => row.id)).toEqual([11])
  })

  it('retains outboxed local rows missing from incoming', () => {
    const local = snapshot({
      votePledges: [pledge({ id: 99, declaredVotes: 300 })],
    })
    const incoming = snapshot({ votePledges: [] })

    const merged = mergeOpsSnapshot(local, incoming, new Set([opsOutboxKey('votePledges', 99)]))

    expect(merged.votePledges).toEqual(local.votePledges)
  })
})

describe('diffOpsIds', () => {
  it('reports added and removed ids per collection', () => {
    const local = snapshot({
      municipalities: [
        municipality({ id: 1, slug: 'itabuna' }),
        municipality({ id: 2, slug: 'cairu' }),
      ],
      votePledges: [pledge({ id: 10 })],
    })
    const incoming = snapshot({
      municipalities: [
        municipality({ id: 1, slug: 'itabuna' }),
        municipality({ id: 3, slug: 'valenca' }),
      ],
      votePledges: [],
    })

    expect(diffOpsIds(local, incoming)).toEqual({
      municipalities: { added: [3], removed: [2] },
      leaderships: { added: [], removed: [] },
      votePledges: { added: [], removed: [10] },
      activities: { added: [], removed: [] },
      stateDeputies: { added: [], removed: [] },
      organizations: { added: [], removed: [] },
      demands: { added: [], removed: [] },
      municipalityUpdates: { added: [], removed: [] },
    })
  })
})
