import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { Consent } from '@/payload-types'

export type TestDatabaseLease = {
  release: () => Promise<void>
}

export type MissingInviteConsentFixtureFaults = {
  beforeRestoreLeaseAcquire?: () => Promise<void>
  beforeSetupLeaseRollback?: () => Promise<void>
  beforeSetupLeaseRelease?: () => Promise<void>
  beforeSnapshotSetup?: () => Promise<void>
  consentKey?: string
  leaseKey?: string
  /**
   * When true (default), the operation window runs under the exclusive lease:
   * parallel spec files can never observe the committed-absent state, so their
   * ensure-then-read helpers cannot create an ephemeral row that the restore
   * deletes out from under them (D9 flake). Set to false only when the
   * operation deliberately exercises concurrent consent writers during the
   * window (see the "creates a missing configured consent only once under
   * concurrent ensures" test).
   */
  serializeWindow?: boolean
}

type LeaseTransaction = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

type InternalTestDatabaseLease = TestDatabaseLease & {
  rollback: () => Promise<void>
  transaction: LeaseTransaction
  transactionID: number | string
}

export type AdvisoryLockMode = 'ExclusiveLock' | 'ShareLock'

export type WaitingAdvisoryLock = {
  activityDatabaseOID: number
  classID: string
  databaseOID: number
  expectedClassID: string
  expectedObjectID: string
  granted: false
  mode: AdvisoryLockMode
  objectID: string
  objectSubID: 1
  pid: number
  virtualTransaction: string
}

export type ConsentSnapshot = {
  id: number
  key: string | null
  text: Consent['text']
  updated_at: Date
  created_at: Date
}

/**
 * Restores consent rows captured before a fixture deleted them, keeping their
 * original ids so parallel spec files never observe the rows absent or with a
 * new id (D9 flake). Shared by the consent fixtures and the Onda0 down test.
 */
export const restoreConsentRows = async (
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>,
  rows: readonly ConsentSnapshot[],
): Promise<void> => {
  for (const row of rows) {
    await execute(sql`
      INSERT INTO "consent" ("id", "key", "text", "updated_at", "created_at")
      VALUES (
        ${row.id},
        ${row.key},
        ${row.text},
        ${row.updated_at},
        ${row.created_at}
      )
      ON CONFLICT ("id") DO UPDATE SET
        "key" = EXCLUDED."key",
        "text" = EXCLUDED."text",
        "updated_at" = EXCLUDED."updated_at",
        "created_at" = EXCLUDED."created_at"
    `)
  }
}

/**
 * Keys the consent fixtures rename the canonical stable row to while a test
 * exercises the fail-closed "key absent" state. A run aborted between the
 * rename commit and the fixture restore leaves the canonical key absent and an
 * orphan row holding one of these names; without a purge, the next run
 * snapshots the key as absent, creates a fresh row, and the same rename then
 * hits the UNIQUE `consent_key_idx` — the pollution is self-sustaining (D10 F1).
 */
const ORPHANED_CONSENT_RENAME_KEYS = [
  'temporarily-renamed-consent',
  'chave-renomeada',
  'chave-temporariamente-ausente',
] as const

/**
 * Deletes orphaned consent rows left by an aborted run: the explicit temporary
 * rename keys. MUST be called while holding the lease key's EXCLUSIVE lease.
 * The 3 names are produced by NO live test anymore (the fail-closed rename
 * tests vacate the canonical row to PRIVATE keys, D10 review finding P1-1), so
 * a row carrying one of them is guaranteed orphaned — the only producer left
 * is the self-heal repro's own plant, which runs under this key's exclusive
 * lease immediately before the healing fixture.
 */
export const purgeOrphanedConsentRenames = async (
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>,
): Promise<void> => {
  await execute(sql`
    DELETE FROM "consent"
    WHERE "key" IN (${sql.join(
      ORPHANED_CONSENT_RENAME_KEYS.map((key) => sql`${key}`),
      sql`, `,
    )})
  `)
}

export const CAMPAIGN_INVITE_CONSENT_LEASE_KEY = 'campaign-invite-consent'
export const SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY = 'supporter-registration-consent'
export const SUPPORTER_VOTE_INTENTION_CONSENT_LEASE_KEY = 'supporter-vote-intention-consent'
/**
 * Serializes spec files that treat the election collections as test-owned:
 * `electionResultsImport.int.spec.ts` wipes ALL election rows, which would
 * delete another election spec's fixtures mid-assertion without the lease.
 */
export const ELECTION_COLLECTIONS_LEASE_KEY = 'election-collections'
const CAMPAIGN_INVITE_CONSENT_KEY = 'lideranca-autopreenchimento'

/** A consent row shared across spec files, protected by an advisory-lock lease. */
export type LeasedConsentFixture = {
  consentKey: string
  leaseKey: string
}
export const fixtureConsentText: Consent['text'] = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Consentimento de teste', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}

const rowsFrom = <Row>(result: unknown): Row[] => {
  if (Array.isArray(result)) return result as Row[]
  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as Row[]
  }
  return []
}

const combineErrors = (primary: unknown, cleanup: unknown, message: string): AggregateError =>
  new AggregateError([primary, cleanup], message)

const addFailure = (primary: unknown | undefined, secondary: unknown, message: string): unknown =>
  primary === undefined ? secondary : combineErrors(primary, secondary, message)

const rollbackWithFault = async (
  lease: InternalTestDatabaseLease,
  beforeRollback: (() => Promise<void>) | undefined,
  message: string,
): Promise<void> => {
  let failure: unknown
  try {
    await beforeRollback?.()
  } catch (error) {
    failure = error
  }
  try {
    await lease.rollback()
  } catch (error) {
    failure = addFailure(failure, error, message)
  }
  if (failure !== undefined) throw failure
}

const beginTestDatabaseLease = async (
  payload: Payload,
  leaseKey: string,
  mode: 'exclusive' | 'shared' = 'exclusive',
  transactionStarted?: (lease: {
    transaction: LeaseTransaction
    transactionID: number | string
  }) => Promise<void>,
): Promise<InternalTestDatabaseLease> => {
  if (payload.db.name !== 'postgres') {
    throw new Error('Integration test database leases require PostgreSQL.')
  }

  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) {
    throw new Error('Unable to start the integration test database lease transaction.')
  }

  const transaction = payload.db.sessions?.[String(transactionID)]?.db as
    | LeaseTransaction
    | undefined
  if (!transaction) {
    const sessionError = new Error('Integration test database lease session is unavailable.')
    try {
      await payload.db.rollbackTransaction(transactionID)
    } catch (rollbackError) {
      throw combineErrors(
        sessionError,
        rollbackError,
        'The integration test database lease session and rollback both failed.',
      )
    }
    throw sessionError
  }

  try {
    await transactionStarted?.({ transaction, transactionID })
    if (mode === 'shared') {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`test:${leaseKey}`}, 0))`,
      )
    } else {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`test:${leaseKey}`}, 0))`,
      )
    }
  } catch (error) {
    try {
      await payload.db.rollbackTransaction(transactionID)
    } catch (rollbackError) {
      throw combineErrors(
        error,
        rollbackError,
        'The integration test database lease acquisition and rollback both failed.',
      )
    }
    throw error
  }

  let released = false
  return {
    transaction,
    transactionID,
    rollback: async () => {
      if (released) return
      await payload.db.rollbackTransaction(transactionID)
      released = true
    },
    release: async () => {
      if (released) return
      try {
        await payload.db.commitTransaction(transactionID)
        released = true
      } catch (commitError) {
        try {
          await payload.db.rollbackTransaction(transactionID)
          released = true
        } catch (rollbackError) {
          throw combineErrors(
            commitError,
            rollbackError,
            'Failed to commit or roll back the integration test database lease.',
          )
        }
        throw commitError
      }
    },
  }
}

export const getTestTransactionBackendPID = async (
  payload: Payload,
  transactionID: number | string,
): Promise<number> => {
  const transaction = payload.db.sessions?.[String(transactionID)]?.db as
    | LeaseTransaction
    | undefined
  if (!transaction) {
    throw new Error('Integration test transaction session is unavailable.')
  }
  const row = rowsFrom<{ pid: number }>(
    await transaction.execute(sql`SELECT pg_backend_pid()::integer AS "pid"`),
  )[0]
  if (!row) {
    throw new Error('Unable to identify the integration test transaction backend.')
  }
  return row.pid
}

export const startTestDatabaseLeaseAcquisition = (
  payload: Payload,
  leaseKey: string,
  mode: 'exclusive' | 'shared' = 'exclusive',
): {
  acquisition: Promise<TestDatabaseLease>
  backendPID: Promise<number>
} => {
  let resolveBackendPID: (pid: number) => void
  let rejectBackendPID: (error: unknown) => void
  const backendPID = new Promise<number>((resolve, reject) => {
    resolveBackendPID = resolve
    rejectBackendPID = reject
  })
  const acquisition = beginTestDatabaseLease(payload, leaseKey, mode, async ({ transactionID }) => {
    try {
      resolveBackendPID(await getTestTransactionBackendPID(payload, transactionID))
    } catch (error) {
      rejectBackendPID(error)
      throw error
    }
  })
  return { acquisition, backendPID }
}

export const waitForAdvisoryLockWaiter = async (
  payload: Payload,
  {
    key,
    mode,
    waiterPID,
  }: {
    key: number | string
    mode: AdvisoryLockMode
    waiterPID: number
  },
): Promise<WaitingAdvisoryLock> => {
  const expectedKey =
    typeof key === 'string' ? sql`hashtextextended(${key}, 0)` : sql`${key}::bigint`
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const result = await payload.db.drizzle.execute(sql`
      WITH expected AS (
        SELECT
          ${expectedKey} AS "key",
          (SELECT oid FROM pg_database WHERE datname = current_database()) AS "databaseOID"
      )
      SELECT
        activity.datid::integer AS "activityDatabaseOID",
        locks.classid::text AS "classID",
        locks.database::integer AS "databaseOID",
        ((expected."key" >> 32) & 4294967295)::text AS "expectedClassID",
        (expected."key" & 4294967295)::text AS "expectedObjectID",
        locks.granted,
        locks.mode,
        locks.objid::text AS "objectID",
        locks.objsubid::integer AS "objectSubID",
        activity.pid::integer AS "pid",
        locks.virtualtransaction AS "virtualTransaction"
      FROM pg_locks AS locks
      INNER JOIN pg_stat_activity AS activity
        ON activity.pid = locks.pid
       AND activity.datid = locks.database
      CROSS JOIN expected
      WHERE locks.locktype = 'advisory'
        AND locks.database = expected."databaseOID"
        AND locks.classid = ((expected."key" >> 32) & 4294967295)::oid
        AND locks.objid = (expected."key" & 4294967295)::oid
        AND locks.objsubid = 1
        AND locks.mode = ${mode}
        AND locks.pid = ${waiterPID}
        AND locks.granted = false
    `)
    const waiting = rowsFrom<WaitingAdvisoryLock>(result)[0]
    if (waiting) return waiting
  }
  throw new Error(`Timed out waiting for backend ${waiterPID} on the exact ${mode} advisory lock.`)
}

export const acquireTestDatabaseLease = async (
  payload: Payload,
  leaseKey: string,
): Promise<TestDatabaseLease> => beginTestDatabaseLease(payload, leaseKey)

export const acquireSharedTestDatabaseLease = async (
  payload: Payload,
  leaseKey: string,
): Promise<TestDatabaseLease> => beginTestDatabaseLease(payload, leaseKey, 'shared')

const withDatabaseLease = async <Result>(
  payload: Payload,
  leaseKey: string,
  acquire: (payload: Payload, leaseKey: string) => Promise<TestDatabaseLease>,
  failureMessage: string,
  operation: () => Promise<Result>,
): Promise<Result> => {
  const lease = await acquire(payload, leaseKey)
  let operationError: unknown
  try {
    return await operation()
  } catch (error) {
    operationError = error
    throw error
  } finally {
    try {
      await lease.release()
    } catch (releaseError) {
      if (operationError !== undefined) {
        throw combineErrors(operationError, releaseError, failureMessage)
      }
      throw releaseError
    }
  }
}

export const withExclusiveTestDatabaseLease = async <Result>(
  payload: Payload,
  leaseKey: string,
  operation: () => Promise<Result>,
): Promise<Result> =>
  withDatabaseLease(
    payload,
    leaseKey,
    acquireTestDatabaseLease,
    'The exclusive leased operation and database lease release both failed.',
    operation,
  )

export const withSharedTestDatabaseLease = async <Result>(
  payload: Payload,
  leaseKey: string,
  operation: () => Promise<Result>,
): Promise<Result> =>
  withDatabaseLease(
    payload,
    leaseKey,
    acquireSharedTestDatabaseLease,
    'The shared leased operation and database lease release both failed.',
    operation,
  )

export const ensureLeasedConsent = async (
  payload: Payload,
  { consentKey, leaseKey }: LeasedConsentFixture,
): Promise<Consent> =>
  withExclusiveTestDatabaseLease(payload, leaseKey, async () => {
    // D10 F1: a run aborted mid-rename leaves an orphan row holding a
    // temporary name and the canonical key absent; the purge clears it so the
    // ensure below can recreate the canonical row without the next rename
    // hitting the UNIQUE constraint. Autocommit is safe: we hold the
    // exclusive lease, so no live renamer can be mid-flight.
    await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
    // Idempotent upsert: INSERT … ON CONFLICT (key) DO NOTHING eliminates the
    // TOCTOU race between the find and the create — even if two ensures slip
    // past the advisory lock under extreme load, the UNIQUE consent_key_idx
    // guarantees exactly one row. The subsequent find always returns the
    // committed row (created by this INSERT or a prior one).
    await payload.db.drizzle.execute(sql`
      INSERT INTO "consent" ("key", "text", "updated_at", "created_at")
      VALUES (${consentKey}, ${fixtureConsentText}, now(), now())
      ON CONFLICT ("key") DO NOTHING
    `)
    const existing = await payload.find({
      collection: 'consent',
      where: { key: { equals: consentKey } },
      limit: 1,
      sort: 'id',
      depth: 0,
    })
    if (!existing.docs[0]) {
      throw new Error(`ensureLeasedConsent: consent key "${consentKey}" not found after upsert.`)
    }
    return existing.docs[0]
  })

export const withLeasedConsent = async <Result>(
  payload: Payload,
  { consentKey, leaseKey }: LeasedConsentFixture,
  operation: (consent: Consent) => Promise<Result>,
): Promise<Result> => {
  // D10 F2 (measurement-driven): the operation holds the SHARED consent lease.
  // Holding exclusive across the operation serialized every writer on the key
  // into a 17-waiter queue and a 15s cascade under 6 workers; running the
  // operation UNLEASED let a parallel fixture's created-row cleanup delete the
  // canonical row out from under a consumer (FK violation). Shared is the
  // stable middle: consumers never serialize against each other (their writes
  // touch disjoint per-test rows, so no lock-order cycle is constructible —
  // every advisory holder acquires at most one lease at a time, and Onda0
  // acquires its three keys in a fixed order) and the exclusive
  // missing-consent window blocks every consumer while the canonical key is
  // absent, so no consumer observes the transient state.
  for (;;) {
    await ensureLeasedConsent(payload, { consentKey, leaseKey })
    const lease = await beginTestDatabaseLease(payload, leaseKey, 'shared')
    let failure: unknown
    let result: Result | undefined
    let retry = false
    try {
      const configured = await payload.find({
        collection: 'consent',
        where: { key: { equals: consentKey } },
        limit: 1,
        sort: 'id',
        depth: 0,
      })
      if (!configured.docs[0]) {
        retry = true
      } else {
        result = await operation(configured.docs[0])
      }
    } catch (error) {
      failure = error
    }
    try {
      await lease.release()
    } catch (releaseError) {
      failure = addFailure(
        failure,
        releaseError,
        'The shared consent callback and database lease release both failed.',
      )
    }
    if (failure !== undefined) throw failure
    if (retry) continue
    return result as Result
  }
}

export const withInviteConsent = async <Result>(
  payload: Payload,
  operation: (consent: Consent) => Promise<Result>,
): Promise<Result> =>
  withLeasedConsent(
    payload,
    { consentKey: CAMPAIGN_INVITE_CONSENT_KEY, leaseKey: CAMPAIGN_INVITE_CONSENT_LEASE_KEY },
    operation,
  )

export const withMissingInviteConsentFixture = async <Result>(
  payload: Payload,
  operation: () => Promise<Result>,
  faults: MissingInviteConsentFixtureFaults = {},
): Promise<Result> => {
  const consentKey = faults.consentKey ?? CAMPAIGN_INVITE_CONSENT_KEY
  const leaseKey = faults.leaseKey ?? CAMPAIGN_INVITE_CONSENT_LEASE_KEY
  const serializeWindow = faults.serializeWindow ?? true
  const setupLease = await beginTestDatabaseLease(payload, leaseKey)
  let snapshot: ConsentSnapshot | undefined
  let setupError: unknown
  try {
    await faults.beforeSnapshotSetup?.()
    // D10 F1: clear orphaned renames left by an aborted run BEFORE snapshotting
    // (we hold the exclusive setup lease, so no live renamer exists). The
    // DELETE runs in autocommit, NOT in the lease transaction: an uncommitted
    // delete would keep its row lock and the fixture's own operation would
    // self-deadlock when it re-uses the purged key (observed on the first D10
    // implementation).
    await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
    snapshot = rowsFrom<ConsentSnapshot>(
      await setupLease.transaction.execute(sql`
        SELECT "id", "key", "text", "updated_at", "created_at"
        FROM "consent"
        WHERE "key" = ${consentKey}
        ORDER BY "id"
        LIMIT 1
      `),
    )[0]
    await setupLease.transaction.execute(sql`DELETE FROM "consent" WHERE "key" = ${consentKey}`)
  } catch (error) {
    setupError = error
  }
  try {
    await faults.beforeSetupLeaseRelease?.()
  } catch (releaseError) {
    setupError = addFailure(
      setupError,
      releaseError,
      'The missing consent fixture setup and lease release both failed.',
    )
  }
  if (setupError === undefined) {
    try {
      await setupLease.release()
    } catch (releaseError) {
      setupError = releaseError
    }
  } else {
    try {
      await rollbackWithFault(
        setupLease,
        faults.beforeSetupLeaseRollback,
        'The missing consent fixture setup rollback failed more than once.',
      )
    } catch (rollbackError) {
      setupError = addFailure(
        setupError,
        rollbackError,
        'The missing consent fixture setup and rollback both failed.',
      )
    }
  }
  if (setupError !== undefined) throw setupError

  // Serialize the operation window under an EXCLUSIVE lease (D10 F2,
  // measurement-driven change from D9's shared window): every consumer of the
  // key — the shared `withLeasedConsent` holders AND the exclusive fixtures —
  // is blocked while the canonical key is committed-absent, so no consumer can
  // observe the transient absence or read/reference a row the restore deletes
  // out from under it (baseline load runs flaked 3/4 with exactly this class:
  // 'Consentimento ainda não configurado' in redeem tests and
  // `consent_id` FK violations). The window is short (a fail-closed action or
  // a no-op), so the queueing behind it is bounded — the D9-era 15s budget
  // blowout happened with the Onda0 provision holding EXCLUSIVE for
  // multi-second writes; since D10 the provision holds exclusive too, but
  // only for ~500ms of short upserts.
  // `serializeWindow: false` keeps the unleased window for operations that
  // deliberately exercise concurrent consent writers. NOTE: with the window
  // leased, the operation must NOT acquire the same lease itself (e.g. via
  // ensureLeasedConsent on the same key) — that would self-deadlock.
  const windowLease = serializeWindow ? await beginTestDatabaseLease(payload, leaseKey) : undefined

  // Close the gap between the setup's committed delete and this acquisition:
  // a writer that queued during the setup (advisory locks grant FIFO) can
  // re-create the row here, which would break the fail-closed operation and
  // make the restore delete a live row. Re-verify committed state while we
  // hold the window lease and delete again if needed.
  if (windowLease) {
    const recreated = await payload.find({
      collection: 'consent',
      where: { key: { equals: consentKey } },
      limit: 1,
      sort: 'id',
      depth: 0,
    })
    if (recreated.docs[0]) {
      await payload.delete({
        collection: 'consent',
        where: { key: { equals: consentKey } },
        depth: 0,
      })
    }
  }

  let result: Result | undefined
  let operationError: unknown
  try {
    result = await operation()
  } catch (error) {
    operationError = error
  }

  let cleanupError: unknown
  let restoreLease: Awaited<ReturnType<typeof beginTestDatabaseLease>> | undefined
  try {
    await faults.beforeRestoreLeaseAcquire?.()
    restoreLease = windowLease ?? (await beginTestDatabaseLease(payload, leaseKey))
  } catch (error) {
    cleanupError = error
    if (windowLease && !restoreLease) {
      try {
        await windowLease.rollback()
      } catch (rollbackError) {
        cleanupError = addFailure(
          cleanupError,
          rollbackError,
          'The missing consent fixture restore acquisition and window lease rollback both failed.',
        )
      }
    }
  }
  if (restoreLease) {
    try {
      await restoreLease.transaction.execute(sql`DELETE FROM "consent" WHERE "key" = ${consentKey}`)
      if (snapshot) {
        await restoreConsentRows((query) => restoreLease.transaction.execute(query), [snapshot])
      }
    } catch (error) {
      cleanupError = error
    }
    try {
      await restoreLease.release()
    } catch (error) {
      cleanupError = addFailure(
        cleanupError,
        error,
        'The missing consent fixture restoration and lease release both failed.',
      )
    }
  }
  if (cleanupError !== undefined) {
    if (operationError !== undefined) {
      throw combineErrors(
        operationError,
        cleanupError,
        'The missing consent fixture callback and cleanup both failed.',
      )
    }
    throw cleanupError
  }
  if (operationError !== undefined) throw operationError
  return result as Result
}

export const withMutableConsentFixture = async <Result>(
  payload: Payload,
  operation: (consent: Consent) => Promise<Result>,
): Promise<Result> => {
  const lease = await beginTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
  let snapshot: ConsentSnapshot | undefined
  let createdConsentID: number | undefined
  let operationError: unknown

  try {
    // D10 F1: clear orphaned renames left by an aborted run BEFORE snapshotting
    // (we hold the exclusive lease, so no live renamer exists). Autocommit,
    // never inside the lease transaction — an uncommitted delete would keep
    // its row lock and the fixture's own operation would self-deadlock when it
    // re-uses the purged key.
    await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
    snapshot = rowsFrom<ConsentSnapshot>(
      await lease.transaction.execute(sql`
        SELECT "id", "key", "text", "updated_at", "created_at"
        FROM "consent"
        WHERE "key" = ${CAMPAIGN_INVITE_CONSENT_KEY}
        ORDER BY "id"
        LIMIT 1
      `),
    )[0]
    const consent = snapshot
      ? await payload.findByID({
          collection: 'consent',
          id: snapshot.id,
          depth: 0,
        })
      : await payload.create({
          collection: 'consent',
          data: {
            key: CAMPAIGN_INVITE_CONSENT_KEY,
            text: fixtureConsentText,
          },
          depth: 0,
        })
    if (!snapshot) createdConsentID = consent.id
    return await operation(consent)
  } catch (error) {
    operationError = error
    throw error
  } finally {
    let cleanupError: unknown
    try {
      if (snapshot) {
        await lease.transaction.execute(sql`
          DELETE FROM "consent"
          WHERE "key" = ${CAMPAIGN_INVITE_CONSENT_KEY}
            AND "id" <> ${snapshot.id}
        `)
        await restoreConsentRows((query) => lease.transaction.execute(query), [snapshot])
      } else if (createdConsentID !== undefined) {
        await lease.transaction.execute(sql`
          DELETE FROM "consent"
          WHERE "id" = ${createdConsentID}
             OR "key" = ${CAMPAIGN_INVITE_CONSENT_KEY}
        `)
      }
    } catch (error) {
      cleanupError = error
    }

    try {
      await lease.release()
    } catch (releaseError) {
      cleanupError =
        cleanupError === undefined
          ? releaseError
          : combineErrors(
              cleanupError,
              releaseError,
              'The consent fixture restoration and database lease release both failed.',
            )
    }

    if (cleanupError !== undefined) {
      if (operationError !== undefined) {
        throw combineErrors(
          operationError,
          cleanupError,
          'The consent fixture callback and cleanup both failed.',
        )
      }
      throw cleanupError
    }
  }
}
