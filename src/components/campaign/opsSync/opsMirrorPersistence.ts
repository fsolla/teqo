/**
 * OH5 mirror persistence — OPFS file first, IndexedDB fallback.
 *
 * Decision (see docs/plans/oh5-sync-provider-mirror.md freshness audit):
 * we dump/hydrate the full OpsSnapshot rather than wiring
 * `@tanstack/browser-db-sqlite-persistence`. The GET `/ops-sync` contract is
 * full-replace merge; TanStack collections stay `localOnly` (same pattern as
 * OH6 outbox). OPFS is still preferred when `navigator.storage.getDirectory`
 * works; otherwise IndexedDB.
 */
import { createEmptyOpsSnapshot, type OpsSnapshot } from '@/lib/campaignOps/opsContract'
import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'

export type OpsMirrorPersistenceMode = 'opfs' | 'idb' | 'memory'

export type OpsMirrorStoredPayload = {
  schemaVersion: number
  lastSyncedAt: string | null
  snapshot: OpsSnapshot
}

export type OpsMirrorStore = {
  readonly mode: OpsMirrorPersistenceMode
  load: () => Promise<OpsMirrorStoredPayload | null>
  save: (payload: OpsMirrorStoredPayload) => Promise<void>
  clear: () => Promise<void>
}

const OPFS_DIR = 'teqo-ops-mirror'
const OPFS_FILE = 'snapshot.json'
const IDB_NAME = 'teqo-ops-mirror'
const IDB_STORE = 'mirror'
const IDB_KEY = 'payload'

export const createMemoryOpsMirrorStore = (
  initial: OpsMirrorStoredPayload | null = null,
): OpsMirrorStore => {
  let payload = initial
  return {
    mode: 'memory',
    load: async () => payload,
    save: async (next) => {
      payload = next
    },
    clear: async () => {
      payload = null
    },
  }
}

const openIdb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })

const idbRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    request.onsuccess = () => resolve(request.result)
  })

export const createIdbOpsMirrorStore = (): OpsMirrorStore => ({
  mode: 'idb',
  load: async () => {
    const db = await openIdb()
    try {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const raw = await idbRequest(tx.objectStore(IDB_STORE).get(IDB_KEY))
      if (!raw || typeof raw !== 'object') return null
      return raw as OpsMirrorStoredPayload
    } finally {
      db.close()
    }
  },
  save: async (payload) => {
    const db = await openIdb()
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      await idbRequest(tx.objectStore(IDB_STORE).put(payload, IDB_KEY))
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
      })
    } finally {
      db.close()
    }
  },
  clear: async () => {
    const db = await openIdb()
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      await idbRequest(tx.objectStore(IDB_STORE).delete(IDB_KEY))
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clear failed'))
      })
    } finally {
      db.close()
    }
  },
})

const canUseOpfs = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'

export const createOpfsOpsMirrorStore = (): OpsMirrorStore => {
  const getFileHandle = async (create: boolean): Promise<FileSystemFileHandle> => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(OPFS_DIR, { create })
    return dir.getFileHandle(OPFS_FILE, { create })
  }

  return {
    mode: 'opfs',
    load: async () => {
      try {
        const handle = await getFileHandle(false)
        const file = await handle.getFile()
        const text = await file.text()
        if (!text) return null
        return JSON.parse(text) as OpsMirrorStoredPayload
      } catch {
        return null
      }
    },
    save: async (payload) => {
      const handle = await getFileHandle(true)
      const writable = await handle.createWritable()
      try {
        await writable.write(JSON.stringify(payload))
      } finally {
        await writable.close()
      }
    },
    clear: async () => {
      try {
        const root = await navigator.storage.getDirectory()
        const dir = await root.getDirectoryHandle(OPFS_DIR, { create: false })
        await dir.removeEntry(OPFS_FILE)
      } catch {
        // Missing dir/file is fine — already clear.
      }
    },
  }
}

/**
 * Boot-time feature detect: try OPFS, fall back to IndexedDB on any failure
 * (private mode, missing API, write probe fail). Never throws.
 */
export const openOpsMirrorStore = async (options?: {
  forceMode?: OpsMirrorPersistenceMode
}): Promise<OpsMirrorStore> => {
  if (options?.forceMode === 'memory') return createMemoryOpsMirrorStore()
  if (options?.forceMode === 'idb') return createIdbOpsMirrorStore()
  if (options?.forceMode === 'opfs') return createOpfsOpsMirrorStore()

  if (canUseOpfs()) {
    try {
      const opfs = createOpfsOpsMirrorStore()
      // Probe write so a later sync doesn't discover OPFS is read-only.
      const existing = await opfs.load()
      if (!existing) {
        await opfs.save({
          schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
          lastSyncedAt: null,
          snapshot: createEmptyOpsSnapshot(new Date(0).toISOString()),
        })
        await opfs.clear()
      }
      return opfs
    } catch {
      // fall through to IDB
    }
  }

  if (typeof indexedDB === 'undefined') {
    return createMemoryOpsMirrorStore()
  }

  try {
    const idb = createIdbOpsMirrorStore()
    // Probe open so a broken IDB surface falls to memory instead of crashing sync.
    await idb.load()
    return idb
  } catch {
    return createMemoryOpsMirrorStore()
  }
}
