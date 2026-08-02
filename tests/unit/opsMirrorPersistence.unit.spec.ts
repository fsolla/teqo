// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createIdbOpsMirrorStore,
  createMemoryOpsMirrorStore,
  openOpsMirrorStore,
} from '@/components/campaign/opsSync/opsMirrorPersistence'
import { createEmptyOpsSnapshot } from '@/lib/campaignOps/opsContract'
import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opsMirrorPersistence', () => {
  it('round-trips through the memory store', async () => {
    const store = createMemoryOpsMirrorStore()
    const payload = {
      schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
      lastSyncedAt: '2026-08-01T12:00:00.000Z',
      snapshot: createEmptyOpsSnapshot('2026-08-01T12:00:00.000Z'),
    }
    await store.save(payload)
    expect(await store.load()).toEqual(payload)
    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('falls back when OPFS is unavailable (no navigator.storage.getDirectory)', async () => {
    vi.stubGlobal('navigator', { storage: {} })

    // Prefer an explicit idb force in environments without a working IDB;
    // openOpsMirrorStore must not throw when OPFS is missing.
    const store = await openOpsMirrorStore({ forceMode: 'idb' })
    expect(store.mode).toBe('idb')

    const auto = await openOpsMirrorStore()
    // jsdom may or may not expose indexedDB — either idb or memory is fine.
    expect(['idb', 'memory']).toContain(auto.mode)
  })

  it('creates an idb store handle without crashing', () => {
    expect(createIdbOpsMirrorStore().mode).toBe('idb')
  })
})
