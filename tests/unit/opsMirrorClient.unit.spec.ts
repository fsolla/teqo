// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyOpsMirrorSnapshot,
  bootstrapOpsMirror,
  getOpsMirrorLastSyncedAt,
  getOpsMirrorPersistenceMode,
  municipalitiesCollection,
  OPS_SYNC_PATH,
  readOpsMirrorSnapshot,
  resetOpsMirrorClientForTests,
  syncOpsMirror,
  votePledgesCollection,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { createMemoryOpsMirrorStore } from '@/components/campaign/opsSync/opsMirrorPersistence'
import {
  formatOpsSyncRelative,
  resolveOpsSyncChromeLabel,
} from '@/components/campaign/opsSync/opsSyncChromeCopy'
import {
  applyOpsVotePledgeEstimateWrite,
  patchOpsVotePledgeEstimateOptimistic,
} from '@/components/campaign/opsSync/opsVotePledgeMirror'
import {
  createEmptyOpsSnapshot,
  opsOutboxKey,
  type OpsSnapshot,
} from '@/lib/campaignOps/opsContract'
import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'
import { isStaffCampaignRole } from '@/lib/campaignRoles'

const baseSnapshot = (overrides: Partial<OpsSnapshot> = {}): OpsSnapshot => ({
  ...createEmptyOpsSnapshot('2026-08-01T12:00:00.000Z'),
  municipalities: [
    {
      id: 1,
      name: 'Salvador',
      slug: 'salvador',
      kind: 'municipio',
      city: 'Salvador',
      region: 'RMS',
      ibgeCode: '2927408',
      updatedAt: '2026-08-01T12:00:00.000Z',
    },
  ],
  votePledges: [
    {
      id: 10,
      leadership: 2,
      municipality: 1,
      declaredVotes: 100,
      estimatedVotes: { pessimistic: 80, central: 100, optimistic: 120 },
      updatedAt: '2026-08-01T12:00:00.000Z',
    },
  ],
  ...overrides,
})

afterEach(async () => {
  await resetOpsMirrorClientForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opsSync chrome copy', () => {
  it('formats relative labels and error/syncing states', () => {
    const now = Date.parse('2026-08-01T12:30:00.000Z')
    expect(formatOpsSyncRelative('2026-08-01T12:29:30.000Z', now)).toBe('Actualizado agora')
    expect(formatOpsSyncRelative('2026-08-01T12:25:00.000Z', now)).toBe('Actualizado há 5m')
    expect(resolveOpsSyncChromeLabel({ status: 'syncing', lastSyncedAt: null })).toBe(
      'A sincronizar…',
    )
    expect(
      resolveOpsSyncChromeLabel({
        status: 'error',
        lastSyncedAt: '2026-08-01T12:00:00.000Z',
      }),
    ).toBe('Dados podem estar desatualizados')
  })
})

describe('opsMirrorClient', () => {
  it('hydrates from store without network when skipNetworkSync', async () => {
    const store = createMemoryOpsMirrorStore({
      schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
      lastSyncedAt: '2026-08-01T11:00:00.000Z',
      snapshot: baseSnapshot(),
    })

    const fetchImpl = vi.fn()
    const result = await bootstrapOpsMirror({ store, skipNetworkSync: true, fetchImpl })

    expect(result.hydrated).toBe(true)
    expect(result.mode).toBe('memory')
    expect(municipalitiesCollection.get(1)?.name).toBe('Salvador')
    expect(getOpsMirrorLastSyncedAt()).toBe('2026-08-01T11:00:00.000Z')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('wipes and rehydrates empty when stored schemaVersion mismatches', async () => {
    const store = createMemoryOpsMirrorStore({
      schemaVersion: OPS_MIRROR_SCHEMA_VERSION + 1,
      lastSyncedAt: '2026-08-01T11:00:00.000Z',
      snapshot: baseSnapshot(),
    })

    await bootstrapOpsMirror({ store, skipNetworkSync: true })

    expect(municipalitiesCollection.size).toBe(0)
    expect(await store.load()).toBeNull()
    expect(getOpsMirrorLastSyncedAt()).toBeNull()
  })

  it('syncs via GET, merges into collections, and persists', async () => {
    const store = createMemoryOpsMirrorStore()
    const incoming = baseSnapshot({
      municipalities: [
        {
          id: 1,
          name: 'Salvador (sync)',
          slug: 'salvador',
          kind: 'municipio',
          city: 'Salvador',
          region: 'RMS',
          ibgeCode: '2927408',
          updatedAt: '2026-08-01T13:00:00.000Z',
        },
        {
          id: 2,
          name: 'Feira',
          slug: 'feira-de-santana',
          kind: 'municipio',
          city: 'Feira de Santana',
          region: 'Portal',
          ibgeCode: '2910800',
          updatedAt: '2026-08-01T13:00:00.000Z',
        },
      ],
    })

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => incoming,
    })

    await bootstrapOpsMirror({ store, skipNetworkSync: true })
    const sync = await syncOpsMirror({ store, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      OPS_SYNC_PATH,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
    expect(sync.status).toBe('idle')
    expect(municipalitiesCollection.get(1)?.name).toBe('Salvador (sync)')
    expect(municipalitiesCollection.get(2)?.name).toBe('Feira')
    expect(getOpsMirrorPersistenceMode()).toBe('memory')

    const stored = await store.load()
    expect(stored?.snapshot.municipalities).toHaveLength(2)
    expect(stored?.lastSyncedAt).toBe(sync.lastSyncedAt)
  })

  it('patches estimate fields after a successful write', () => {
    applyOpsMirrorSnapshot(baseSnapshot())
    applyOpsVotePledgeEstimateWrite({
      id: 10,
      leadership: 2,
      municipality: 1,
      declaredVotes: 100,
      updatedAt: '2026-08-01T14:00:00.000Z',
      estimatedVotes: { pessimistic: 90, central: 110, optimistic: 130 },
      estimateNote: 'patch',
      estimatedBy: 3,
      estimatedAt: '2026-08-01T14:00:00.000Z',
    })

    expect(votePledgesCollection.get(10)?.estimatedVotes?.central).toBe(110)
    expect(votePledgesCollection.get(10)?.estimatedAt).toBe('2026-08-01T14:00:00.000Z')
    expect(votePledgesCollection.get(10)?.estimateNote).toBe('patch')
  })

  it('applies optimistic estimate patches while pending', () => {
    applyOpsMirrorSnapshot(baseSnapshot())
    patchOpsVotePledgeEstimateOptimistic(
      10,
      { pessimistic: 70, central: 80, optimistic: 90 },
      'optimistic local',
    )

    expect(votePledgesCollection.get(10)?.estimatedVotes?.central).toBe(80)
    expect(votePledgesCollection.get(10)?.estimateNote).toBe('optimistic local')
  })

  it('does not smash outbox-marked pledge rows on merge', async () => {
    applyOpsMirrorSnapshot(
      baseSnapshot({
        votePledges: [
          {
            id: 10,
            leadership: 2,
            municipality: 1,
            declaredVotes: 100,
            estimatedVotes: { pessimistic: 50, central: 60, optimistic: 70 },
            updatedAt: '2026-08-01T10:00:00.000Z',
          },
        ],
      }),
    )

    const store = createMemoryOpsMirrorStore()
    const incoming = baseSnapshot({
      votePledges: [
        {
          id: 10,
          leadership: 2,
          municipality: 1,
          declaredVotes: 100,
          estimatedVotes: { pessimistic: 200, central: 300, optimistic: 400 },
          updatedAt: '2026-08-01T13:00:00.000Z',
        },
      ],
    })

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => incoming,
    })

    const sync = await syncOpsMirror({
      store,
      fetchImpl,
      outboxKeys: new Set([opsOutboxKey('votePledges', 10)]),
    })

    expect(sync.status).toBe('idle')
    expect(votePledgesCollection.get(10)?.estimatedVotes?.central).toBe(60)
  })

  it('returns error state when fetch fails (chrome can show stale)', async () => {
    const store = createMemoryOpsMirrorStore({
      schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
      lastSyncedAt: '2026-08-01T11:00:00.000Z',
      snapshot: baseSnapshot(),
    })
    await bootstrapOpsMirror({ store, skipNetworkSync: true })

    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const sync = await syncOpsMirror({ store, fetchImpl })

    expect(sync.status).toBe('error')
    expect(sync.lastError).toMatch(/network down/)
    expect(sync.lastSyncedAt).toBe('2026-08-01T11:00:00.000Z')
    expect(readOpsMirrorSnapshot().municipalities).toHaveLength(1)
  })

  it('skips apply when revisedAt is unchanged and outbox is empty', async () => {
    const snapshot = baseSnapshot()
    const store = createMemoryOpsMirrorStore({
      schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
      lastSyncedAt: '2026-08-01T11:00:00.000Z',
      snapshot,
    })
    await bootstrapOpsMirror({ store, skipNetworkSync: true })

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    })
    const sync = await syncOpsMirror({ store, fetchImpl, outboxKeys: new Set() })

    expect(sync.status).toBe('idle')
    expect(sync.lastSyncedAt).toBe('2026-08-01T11:00:00.000Z')
    expect(municipalitiesCollection.get(1)?.name).toBe('Salvador')
  })
})

describe('leader defense in depth (layout gate)', () => {
  it('treats leader as non-staff so provider stays no-op', () => {
    expect(isStaffCampaignRole('leader')).toBe(false)
    expect(isStaffCampaignRole('advisor')).toBe(true)
    expect(isStaffCampaignRole('coordinator')).toBe(true)
    expect(isStaffCampaignRole('candidate')).toBe(true)
  })
})
