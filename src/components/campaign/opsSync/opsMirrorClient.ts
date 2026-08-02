'use client'

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db'

import { collectOpsEstimateOutboxKeys } from '@/components/campaign/opsSync/opsEstimateOutbox'
import {
  openOpsMirrorStore,
  type OpsMirrorPersistenceMode,
  type OpsMirrorStore,
} from '@/components/campaign/opsSync/opsMirrorPersistence'
import { votePledgesCollection } from '@/components/campaign/opsSync/opsVotePledgeMirror'
import {
  createEmptyOpsSnapshot,
  type OpsActivity,
  type OpsDemand,
  type OpsGoals,
  type OpsLeadership,
  type OpsMunicipality,
  type OpsMunicipalityUpdate,
  type OpsOrganization,
  type OpsOutboxKey,
  type OpsSnapshot,
  type OpsStateDeputy,
} from '@/lib/campaignOps/opsContract'
import { mergeOpsSnapshot } from '@/lib/campaignOps/opsMerge'
import { OPS_MIRROR_SCHEMA_VERSION } from '@/lib/campaignOps/opsMirrorVersion'
import type { OpsSyncState } from '@/lib/campaignOps/opsSyncMeta'

export const OPS_SYNC_PATH = '/campanha/api/ops-sync'

const createRowCollection = <T extends { id: number }>(id: string) =>
  createCollection(
    localOnlyCollectionOptions<T, number>({
      id,
      getKey: (row) => row.id,
    }),
  )

export const municipalitiesCollection = createRowCollection<OpsMunicipality>('ops-municipalities')
<<<<<<< HEAD
const leadershipsCollection = createRowCollection<OpsLeadership>('ops-leaderships')
export { votePledgesCollection } from '@/components/campaign/opsSync/opsVotePledgeMirror'
=======
export const leadershipsCollection = createRowCollection<OpsLeadership>('ops-leaderships')
export const votePledgesCollection = createRowCollection<OpsVotePledge>('ops-vote-pledges')
>>>>>>> 719e35ce (OH9: dual-path municipality detail (HeaderView + Local + OfflineBoundary))
const activitiesCollection = createRowCollection<OpsActivity>('ops-activities')
const stateDeputiesCollection = createRowCollection<OpsStateDeputy>('ops-state-deputies')
const organizationsCollection = createRowCollection<OpsOrganization>('ops-organizations')
const demandsCollection = createRowCollection<OpsDemand>('ops-demands')
const municipalityUpdatesCollection = createRowCollection<OpsMunicipalityUpdate>(
  'ops-municipality-updates',
)

let goalsMirror: OpsGoals | null = null
let revisedAtMirror: string = new Date(0).toISOString()
let schemaVersionMirror: number = OPS_MIRROR_SCHEMA_VERSION
let lastSyncedAtMirror: string | null = null
let persistenceMode: OpsMirrorPersistenceMode | null = null
let storeSingleton: OpsMirrorStore | null = null
let bootPromise: Promise<{ mode: OpsMirrorPersistenceMode; hydrated: boolean }> | null = null

const replaceCollectionRows = <T extends { id: number }>(
  collection: {
    keys: () => IterableIterator<number>
    has: (key: number) => boolean
    delete: (key: number) => unknown
    insert: (row: T) => unknown
  },
  rows: T[],
): void => {
  const incomingIds = new Set(rows.map((row) => row.id))
  for (const key of collection.keys()) {
    if (!incomingIds.has(key)) collection.delete(key)
  }
  for (const row of rows) {
    if (collection.has(row.id)) {
      collection.delete(row.id)
    }
    collection.insert(row)
  }
}

export const readOpsMirrorSnapshot = (): OpsSnapshot => ({
  revisedAt: revisedAtMirror,
  schemaVersion: schemaVersionMirror,
  municipalities: municipalitiesCollection.toArray,
  leaderships: leadershipsCollection.toArray,
  votePledges: votePledgesCollection.toArray,
  activities: activitiesCollection.toArray,
  stateDeputies: stateDeputiesCollection.toArray,
  organizations: organizationsCollection.toArray,
  demands: demandsCollection.toArray,
  municipalityUpdates: municipalityUpdatesCollection.toArray,
  goals: goalsMirror,
})

export const applyOpsMirrorSnapshot = (snapshot: OpsSnapshot): void => {
  revisedAtMirror = snapshot.revisedAt
  schemaVersionMirror = snapshot.schemaVersion
  goalsMirror = snapshot.goals
  replaceCollectionRows(municipalitiesCollection, snapshot.municipalities)
  replaceCollectionRows(leadershipsCollection, snapshot.leaderships)
  replaceCollectionRows(votePledgesCollection, snapshot.votePledges)
  replaceCollectionRows(activitiesCollection, snapshot.activities)
  replaceCollectionRows(stateDeputiesCollection, snapshot.stateDeputies)
  replaceCollectionRows(organizationsCollection, snapshot.organizations)
  replaceCollectionRows(demandsCollection, snapshot.demands)
  replaceCollectionRows(municipalityUpdatesCollection, snapshot.municipalityUpdates)
}

const wipeOpsMirrorCollections = (): void => {
  applyOpsMirrorSnapshot(createEmptyOpsSnapshot(new Date(0).toISOString()))
  lastSyncedAtMirror = null
}

export const getOpsMirrorPersistenceMode = (): OpsMirrorPersistenceMode | null => persistenceMode

export const getOpsMirrorLastSyncedAt = (): string | null => lastSyncedAtMirror

/** Test/DI seam — reset module singletons between unit cases. */
export const resetOpsMirrorClientForTests = async (): Promise<void> => {
  wipeOpsMirrorCollections()
  storeSingleton = null
  bootPromise = null
  persistenceMode = null
}

const resolveOutboxKeys = (explicit?: ReadonlySet<OpsOutboxKey>): ReadonlySet<OpsOutboxKey> => {
  if (explicit) return explicit
  return collectOpsEstimateOutboxKeys()
}

const persistMirrorSnapshot = async (
  store: OpsMirrorStore,
  snapshot: OpsSnapshot,
  lastSyncedAt: string | null,
) => {
  await store.save({
    schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
    lastSyncedAt,
    snapshot,
  })
}

export type BootstrapOpsMirrorOptions = {
  store?: OpsMirrorStore
  forceMode?: OpsMirrorPersistenceMode
  skipNetworkSync?: boolean
  fetchImpl?: typeof fetch
  outboxKeys?: ReadonlySet<OpsOutboxKey>
}

export const bootstrapOpsMirror = async (
  options: BootstrapOpsMirrorOptions = {},
): Promise<{ mode: OpsMirrorPersistenceMode; hydrated: boolean }> => {
  if (bootPromise && !options.store && !options.forceMode) return bootPromise

  const run = async () => {
    const store = options.store ?? (await openOpsMirrorStore({ forceMode: options.forceMode }))
    storeSingleton = store
    persistenceMode = store.mode

    const stored = await store.load()
    let hydrated = false

    if (stored) {
      if (stored.schemaVersion !== OPS_MIRROR_SCHEMA_VERSION) {
        await store.clear()
        wipeOpsMirrorCollections()
      } else {
        applyOpsMirrorSnapshot(stored.snapshot)
        lastSyncedAtMirror = stored.lastSyncedAt
        hydrated = stored.snapshot.municipalities.length > 0 || stored.lastSyncedAt != null
      }
    }

    if (!options.skipNetworkSync) {
      await syncOpsMirror({
        fetchImpl: options.fetchImpl,
        outboxKeys: options.outboxKeys,
      })
    }

    return { mode: store.mode, hydrated }
  }

  if (!options.store && !options.forceMode) {
    bootPromise = run()
    return bootPromise
  }

  return run()
}

export type SyncOpsMirrorOptions = {
  fetchImpl?: typeof fetch
  outboxKeys?: ReadonlySet<OpsOutboxKey>
  store?: OpsMirrorStore
}

export const syncOpsMirror = async (options: SyncOpsMirrorOptions = {}): Promise<OpsSyncState> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const store = options.store ?? storeSingleton

  try {
    const response = await fetchImpl(OPS_SYNC_PATH, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = `ops-sync ${response.status}`
      return {
        status: 'error',
        lastSyncedAt: lastSyncedAtMirror,
        lastError: message,
      }
    }

    const incoming = (await response.json()) as OpsSnapshot
    if (
      typeof incoming?.revisedAt !== 'string' ||
      typeof incoming?.schemaVersion !== 'number' ||
      !Array.isArray(incoming.municipalities)
    ) {
      return {
        status: 'error',
        lastSyncedAt: lastSyncedAtMirror,
        lastError: 'ops-sync payload inválido',
      }
    }

    const outboxKeys = resolveOutboxKeys(options.outboxKeys)
    const local = readOpsMirrorSnapshot()

    // Skip apply+persist when the server mirror is unchanged and nothing is outboxed.
    if (incoming.revisedAt === local.revisedAt && outboxKeys.size === 0 && lastSyncedAtMirror) {
      return { status: 'idle', lastSyncedAt: lastSyncedAtMirror }
    }

    const merged = mergeOpsSnapshot(local, incoming, outboxKeys)
    applyOpsMirrorSnapshot(merged)

    const syncedAt = new Date().toISOString()
    lastSyncedAtMirror = syncedAt

    if (store) {
      await persistMirrorSnapshot(store, merged, syncedAt)
    }

    return { status: 'idle', lastSyncedAt: syncedAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'error',
      lastSyncedAt: lastSyncedAtMirror,
      lastError: message,
    }
  }
}
