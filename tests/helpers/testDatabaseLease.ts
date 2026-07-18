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

type ConsentSnapshot = {
  id: number
  key: string | null
  text: Consent['text']
  updated_at: Date
  created_at: Date
}

export const CAMPAIGN_INVITE_CONSENT_LEASE_KEY = 'campaign-invite-consent'
const CAMPAIGN_INVITE_CONSENT_KEY = 'lideranca-autopreenchimento'
const fixtureConsentText: Consent['text'] = {
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

const addFailure = (
  primary: unknown | undefined,
  secondary: unknown,
  message: string,
): unknown => (primary === undefined ? secondary : combineErrors(primary, secondary, message))

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
  const acquisition = beginTestDatabaseLease(
    payload,
    leaseKey,
    mode,
    async ({ transactionID }) => {
      try {
        resolveBackendPID(await getTestTransactionBackendPID(payload, transactionID))
      } catch (error) {
        rejectBackendPID(error)
        throw error
      }
    },
  )
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
  throw new Error(
    `Timed out waiting for backend ${waiterPID} on the exact ${mode} advisory lock.`,
  )
}

export const acquireTestDatabaseLease = async (
  payload: Payload,
  leaseKey: string,
): Promise<TestDatabaseLease> => beginTestDatabaseLease(payload, leaseKey)

export const acquireSharedTestDatabaseLease = async (
  payload: Payload,
  leaseKey: string,
): Promise<TestDatabaseLease> => beginTestDatabaseLease(payload, leaseKey, 'shared')

export const withTestDatabaseLease = async <Result>(
  payload: Payload,
  leaseKey: string,
  operation: () => Promise<Result>,
): Promise<Result> => {
  const lease = await acquireTestDatabaseLease(payload, leaseKey)
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
        throw combineErrors(
          operationError,
          releaseError,
          'The leased operation and database lease release both failed.',
        )
      }
      throw releaseError
    }
  }
}

export const withSharedTestDatabaseLease = async <Result>(
  payload: Payload,
  leaseKey: string,
  operation: () => Promise<Result>,
): Promise<Result> => {
  const lease = await acquireSharedTestDatabaseLease(payload, leaseKey)
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
        throw combineErrors(
          operationError,
          releaseError,
          'The shared leased operation and database lease release both failed.',
        )
      }
      throw releaseError
    }
  }
}

export const ensureInviteConsent = async (payload: Payload): Promise<Consent> =>
  withTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY, async () => {
    const existing = await payload.find({
      collection: 'consent',
      where: { key: { equals: CAMPAIGN_INVITE_CONSENT_KEY } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) return existing.docs[0]

    return payload.create({
      collection: 'consent',
      data: {
        key: CAMPAIGN_INVITE_CONSENT_KEY,
        text: fixtureConsentText,
      },
      depth: 0,
    })
  })

export const withInviteConsent = async <Result>(
  payload: Payload,
  operation: (consent: Consent) => Promise<Result>,
): Promise<Result> => {
  for (;;) {
    await ensureInviteConsent(payload)
    const lease = await beginTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY, 'shared')
    let failure: unknown
    let result: Result | undefined
    let retry = false
    try {
      const configured = await payload.find({
        collection: 'consent',
        where: { key: { equals: CAMPAIGN_INVITE_CONSENT_KEY } },
        limit: 1,
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

export const withMissingInviteConsentFixture = async <Result>(
  payload: Payload,
  operation: () => Promise<Result>,
  faults: MissingInviteConsentFixtureFaults = {},
): Promise<Result> => {
  const consentKey = faults.consentKey ?? CAMPAIGN_INVITE_CONSENT_KEY
  const leaseKey = faults.leaseKey ?? CAMPAIGN_INVITE_CONSENT_LEASE_KEY
  const setupLease = await beginTestDatabaseLease(payload, leaseKey)
  let snapshot: ConsentSnapshot | undefined
  let setupError: unknown
  try {
    await faults.beforeSnapshotSetup?.()
    snapshot = rowsFrom<ConsentSnapshot>(
      await setupLease.transaction.execute(sql`
        SELECT "id", "key", "text", "updated_at", "created_at"
        FROM "consent"
        WHERE "key" = ${consentKey}
        LIMIT 1
      `),
    )[0]
    await setupLease.transaction.execute(
      sql`DELETE FROM "consent" WHERE "key" = ${consentKey}`,
    )
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
    restoreLease = await beginTestDatabaseLease(payload, leaseKey)
  } catch (error) {
    cleanupError = error
  }
  if (restoreLease) {
    try {
      await restoreLease.transaction.execute(
        sql`DELETE FROM "consent" WHERE "key" = ${consentKey}`,
      )
      if (snapshot) {
        await restoreLease.transaction.execute(sql`
          INSERT INTO "consent" ("id", "key", "text", "updated_at", "created_at")
          VALUES (
            ${snapshot.id},
            ${snapshot.key},
            ${snapshot.text},
            ${snapshot.updated_at},
            ${snapshot.created_at}
          )
          ON CONFLICT ("id") DO UPDATE SET
            "key" = EXCLUDED."key",
            "text" = EXCLUDED."text",
            "updated_at" = EXCLUDED."updated_at",
            "created_at" = EXCLUDED."created_at"
        `)
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
    snapshot = rowsFrom<ConsentSnapshot>(
      await lease.transaction.execute(sql`
        SELECT "id", "key", "text", "updated_at", "created_at"
        FROM "consent"
        WHERE "key" = ${CAMPAIGN_INVITE_CONSENT_KEY}
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
        await lease.transaction.execute(sql`
          INSERT INTO "consent" ("id", "key", "text", "updated_at", "created_at")
          VALUES (
            ${snapshot.id},
            ${snapshot.key},
            ${snapshot.text},
            ${snapshot.updated_at},
            ${snapshot.created_at}
          )
          ON CONFLICT ("id") DO UPDATE SET
            "key" = EXCLUDED."key",
            "text" = EXCLUDED."text",
            "updated_at" = EXCLUDED."updated_at",
            "created_at" = EXCLUDED."created_at"
        `)
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
