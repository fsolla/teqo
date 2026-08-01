import {
  OPS_COLLECTION_KEYS,
  type OpsCollectionKey,
  type OpsOutboxKey,
  type OpsSnapshot,
  opsOutboxKey,
} from './opsContract'

type OpsRow = { id: number }

export type OpsCollectionIdDiff = {
  added: number[]
  removed: number[]
}

export type OpsIdDiff = Record<OpsCollectionKey, OpsCollectionIdDiff>

const mergeRowCollection = <TRow extends OpsRow>(
  localRows: TRow[],
  incomingRows: TRow[],
  collection: OpsCollectionKey,
  outboxKeys: ReadonlySet<OpsOutboxKey>,
): TRow[] => {
  const localById = new Map(localRows.map((row) => [row.id, row]))
  const merged: TRow[] = []

  for (const incomingRow of incomingRows) {
    const key = opsOutboxKey(collection, incomingRow.id)
    if (outboxKeys.has(key)) {
      const localRow = localById.get(incomingRow.id)
      if (localRow) merged.push(localRow)
      continue
    }
    merged.push(incomingRow)
  }

  for (const localRow of localRows) {
    const key = opsOutboxKey(collection, localRow.id)
    if (!outboxKeys.has(key)) continue
    if (incomingRows.some((row) => row.id === localRow.id)) continue
    merged.push(localRow)
  }

  return merged
}

const diffRowCollection = (
  localRows: readonly OpsRow[],
  incomingRows: readonly OpsRow[],
): OpsCollectionIdDiff => {
  const localIds = new Set(localRows.map((row) => row.id))
  const incomingIds = new Set(incomingRows.map((row) => row.id))

  const added: number[] = []
  const removed: number[] = []

  for (const id of incomingIds) {
    if (!localIds.has(id)) added.push(id)
  }

  for (const id of localIds) {
    if (!incomingIds.has(id)) removed.push(id)
  }

  added.sort((a, b) => a - b)
  removed.sort((a, b) => a - b)

  return { added, removed }
}

/**
 * Full-replace merge scoped by outbox keys: rows with pending/conflict writes
 * keep the local copy; everything else is replaced by `incoming`; rows absent
 * from `incoming` are dropped unless outboxed.
 */
export const mergeOpsSnapshot = (
  local: OpsSnapshot,
  incoming: OpsSnapshot,
  outboxKeys: ReadonlySet<OpsOutboxKey>,
): OpsSnapshot => ({
  revisedAt: incoming.revisedAt,
  schemaVersion: incoming.schemaVersion,
  municipalities: mergeRowCollection(local.municipalities, incoming.municipalities, 'municipalities', outboxKeys),
  leaderships: mergeRowCollection(local.leaderships, incoming.leaderships, 'leaderships', outboxKeys),
  votePledges: mergeRowCollection(local.votePledges, incoming.votePledges, 'votePledges', outboxKeys),
  activities: mergeRowCollection(local.activities, incoming.activities, 'activities', outboxKeys),
  stateDeputies: mergeRowCollection(local.stateDeputies, incoming.stateDeputies, 'stateDeputies', outboxKeys),
  organizations: mergeRowCollection(local.organizations, incoming.organizations, 'organizations', outboxKeys),
  demands: mergeRowCollection(local.demands, incoming.demands, 'demands', outboxKeys),
  municipalityUpdates: mergeRowCollection(
    local.municipalityUpdates,
    incoming.municipalityUpdates,
    'municipalityUpdates',
    outboxKeys,
  ),
  goals: incoming.goals,
})

/** Per-collection id adds/removals between two snapshots (ignores outbox). */
export const diffOpsIds = (local: OpsSnapshot, incoming: OpsSnapshot): OpsIdDiff => {
  const diff: Partial<OpsIdDiff> = {}

  for (const collection of OPS_COLLECTION_KEYS) {
    diff[collection] = diffRowCollection(local[collection], incoming[collection])
  }

  return diff as OpsIdDiff
}
