// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Consent } from '@/payload-types'
import config from '@/payload.config'
import {
  acquireSharedTestDatabaseLease,
  acquireTestDatabaseLease,
  CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
  ensureLeasedConsent,
  fixtureConsentText,
  purgeOrphanedConsentRenames,
  startTestDatabaseLeaseAcquisition,
  waitForAdvisoryLockWaiter,
  withInviteConsent,
  withMissingInviteConsentFixture,
  withMutableConsentFixture,
  withSharedTestDatabaseLease,
  type TestDatabaseLease,
} from '../helpers/testDatabaseLease'

let payload: Payload

const expectExactWaiter = (
  waiting: Awaited<ReturnType<typeof waitForAdvisoryLockWaiter>>,
  pid: number,
  mode: 'ExclusiveLock' | 'ShareLock',
) => {
  expect(waiting).toEqual({
    activityDatabaseOID: waiting.databaseOID,
    classID: waiting.expectedClassID,
    databaseOID: expect.any(Number),
    expectedClassID: expect.stringMatching(/^\d+$/),
    expectedObjectID: expect.stringMatching(/^\d+$/),
    granted: false,
    mode,
    objectID: waiting.expectedObjectID,
    objectSubID: 1,
    pid,
    virtualTransaction: expect.stringMatching(/^\d+\/\d+$/),
  })
  expect(waiting.databaseOID).toBeGreaterThan(0)
}

describe('test database lease', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('blocks an independent transaction session until the first lease releases', async () => {
    const first = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    let secondEntered = false
    const pendingSecond = startTestDatabaseLeaseAcquisition(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
    )
    const secondPID = await pendingSecond.backendPID
    const secondAcquisition = pendingSecond.acquisition.then((lease) => {
      secondEntered = true
      return lease
    })

    const waiting = await waitForAdvisoryLockWaiter(payload, {
      key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
      mode: 'ExclusiveLock',
      waiterPID: secondPID,
    })
    expectExactWaiter(waiting, secondPID, 'ExclusiveLock')
    expect(secondEntered).toBe(false)
    await first.release()

    const second = await secondAcquisition
    expect(secondEntered).toBe(true)
    await second.release()
  })

  it('allows shared readers to overlap and blocks an exclusive writer until both release', async () => {
    const firstReader = await acquireSharedTestDatabaseLease(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
    )
    const secondReader = await acquireSharedTestDatabaseLease(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
    )
    let writerEntered = false
    const pendingWriter = startTestDatabaseLeaseAcquisition(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
    )
    const writerPID = await pendingWriter.backendPID
    const writerAcquisition = pendingWriter.acquisition.then((lease) => {
      writerEntered = true
      return lease
    })

    const waiting = await waitForAdvisoryLockWaiter(payload, {
      key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
      mode: 'ExclusiveLock',
      waiterPID: writerPID,
    })
    expectExactWaiter(waiting, writerPID, 'ExclusiveLock')
    expect(writerEntered).toBe(false)
    await firstReader.release()
    const stillWaiting = await waitForAdvisoryLockWaiter(payload, {
      key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
      mode: 'ExclusiveLock',
      waiterPID: writerPID,
    })
    expectExactWaiter(stillWaiting, writerPID, 'ExclusiveLock')
    expect(stillWaiting.virtualTransaction).toBe(waiting.virtualTransaction)
    expect(writerEntered).toBe(false)
    await secondReader.release()

    const writer = await writerAcquisition
    expect(writerEntered).toBe(true)
    await writer.release()
  })

  it('blocks shared readers while an exclusive writer is active', async () => {
    const writer = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    let readerEntered = false
    const pendingReader = startTestDatabaseLeaseAcquisition(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
      'shared',
    )
    const readerPID = await pendingReader.backendPID
    const readerAcquisition = pendingReader.acquisition.then((lease) => {
      readerEntered = true
      return lease
    })

    const waiting = await waitForAdvisoryLockWaiter(payload, {
      key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
      mode: 'ShareLock',
      waiterPID: readerPID,
    })
    expectExactWaiter(waiting, readerPID, 'ShareLock')
    expect(readerEntered).toBe(false)
    await writer.release()

    const reader = await readerAcquisition
    expect(readerEntered).toBe(true)
    await reader.release()
  })

  it('creates a missing configured consent only once under concurrent ensures', async () => {
    // Private key/lease: this test deliberately exercises ensure-then-create
    // racing the missing window, so its window stays unleased
    // (serializeWindow: false — the ensures lease themselves). Running the
    // race on a private key keeps the stable invite row untouched: an
    // unleased window on a shared key would let other files' fixtures observe
    // the committed-absent state and delete the row out from under them.
    const raceKey = `ensure-race-${Date.now()}-${Math.random()}`
    const raceLeaseKey = `ensure-race-lease-${Date.now()}-${Math.random()}`
    await withMissingInviteConsentFixture(
      payload,
      async () => {
        const ensured = await Promise.all([
          ensureLeasedConsent(payload, { consentKey: raceKey, leaseKey: raceLeaseKey }),
          ensureLeasedConsent(payload, { consentKey: raceKey, leaseKey: raceLeaseKey }),
          ensureLeasedConsent(payload, { consentKey: raceKey, leaseKey: raceLeaseKey }),
        ])
        const configured = await withSharedTestDatabaseLease(payload, raceLeaseKey, () =>
          payload.find({
            collection: 'consent',
            where: { key: { equals: raceKey } },
            depth: 0,
            limit: 10,
          }),
        )

        expect(new Set(ensured.map((document) => document.id))).toHaveLength(1)
        expect(configured.docs).toHaveLength(1)
      },
      { consentKey: raceKey, leaseKey: raceLeaseKey, serializeWindow: false },
    )
  })

  it('blocks other consent users while the missing-consent operation window is open', async () => {
    const before = await withInviteConsent(payload, async (consent) => consent)

    let writerAcquisition: Promise<TestDatabaseLease> | undefined
    let readerAcquisition: Promise<TestDatabaseLease> | undefined
    try {
      await withMissingInviteConsentFixture(payload, async () => {
        let writerEntered = false
        const pendingWriter = startTestDatabaseLeaseAcquisition(
          payload,
          CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
        )
        writerAcquisition = pendingWriter.acquisition.then((lease) => {
          writerEntered = true
          return lease
        })
        const writerPID = await pendingWriter.backendPID

        const waiting = await waitForAdvisoryLockWaiter(payload, {
          key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
          mode: 'ExclusiveLock',
          waiterPID: writerPID,
        })
        expectExactWaiter(waiting, writerPID, 'ExclusiveLock')
        expect(writerEntered).toBe(false)

        // D10 F2: the window is EXCLUSIVE, so even a SHARED consumer queues
        // while the canonical key is committed-absent — no consumer can
        // observe the transient absence (baseline load runs flaked 3/4 with
        // consumers reading the absent key or referencing a row the restore
        // deleted out from under them). The reader is NOT awaited here: it
        // only unblocks when this window releases, which is after the
        // operation returns.
        let readerEntered = false
        const pendingReader = startTestDatabaseLeaseAcquisition(
          payload,
          CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
          'shared',
        )
        readerAcquisition = pendingReader.acquisition.then((lease) => {
          readerEntered = true
          return lease
        })
        const readerPID = await pendingReader.backendPID
        const readerWaiting = await waitForAdvisoryLockWaiter(payload, {
          key: `test:${CAMPAIGN_INVITE_CONSENT_LEASE_KEY}`,
          mode: 'ShareLock',
          waiterPID: readerPID,
        })
        expectExactWaiter(readerWaiting, readerPID, 'ShareLock')
        expect(readerEntered).toBe(false)
      })
    } finally {
      // Release the waiter leases even when an assertion above fails, so the
      // pending acquisitions never block parallel spec files until teardown.
      if (writerAcquisition) {
        const writer = await writerAcquisition
        await writer.release()
      }
      if (readerAcquisition) {
        const reader = await readerAcquisition
        await reader.release()
      }
    }

    const after = await withInviteConsent(payload, async (consent) => consent)
    // id+key only: a concurrent legitimate writer (e.g. the Onda0 provision)
    // may update the row's text between these reads — the window's contract is
    // that no exclusive writer interleaves, not that the text is frozen.
    expect(after).toMatchObject({
      id: before.id,
      key: before.key,
    })
  })

  it('releases a shared consent scope after its callback fails', async () => {
    const callbackFailure = new Error('intentional shared callback failure')

    await expect(
      withInviteConsent(payload, async () => {
        throw callbackFailure
      }),
    ).rejects.toBe(callbackFailure)

    const writer = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    await writer.release()
  })

  it('restores the exact configured consent after deletion and recreation', async () => {
    // The reference is the fixture's own snapshot (the configured consent the
    // callback receives), not a separate read: a concurrent legitimate writer
    // (e.g. the Onda0 provision) may update the row's text between reads, and
    // the restore faithfully reproduces whatever the snapshot captured.
    let before: Consent | undefined
    await withMutableConsentFixture(payload, async (consent) => {
      before = consent
      await payload.delete({ collection: 'consent', id: consent.id })
      await payload.create({
        collection: 'consent',
        data: {
          key: 'lideranca-autopreenchimento',
          text: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Temporary recreation', version: 1 }],
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
          },
        },
        depth: 0,
      })
    })

    const after = await withInviteConsent(payload, async (consent) => consent)
    if (!before) throw new Error('The mutable consent fixture must have provided a snapshot.')
    expect(after).toMatchObject({
      id: before.id,
      key: before.key,
      text: before.text,
    })
  })

  it('restores the configured consent and releases after a callback assertion failure', async () => {
    const before = await withSharedTestDatabaseLease(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
      () =>
        payload.find({
          collection: 'consent',
          where: { key: { equals: 'lideranca-autopreenchimento' } },
          depth: 0,
          limit: 1,
        }),
    )
    const callbackFailure = new Error('intentional callback assertion failure')
    // The reference is the fixture's own snapshot (what the callback received),
    // not the `before` read: a concurrent legitimate writer (e.g. the Onda0
    // provision) may update the row's text between reads, and the restore
    // faithfully reproduces whatever the snapshot captured. `before` still
    // pins the existence state (restored vs created-then-deleted).
    let snapshot: Consent | undefined

    await expect(
      withMutableConsentFixture(payload, async (consent) => {
        snapshot = consent
        await payload.update({
          collection: 'consent',
          id: consent.id,
          data: {
            key: 'temporarily-renamed-consent',
            text: {
              root: {
                type: 'root',
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Temporary text', version: 1 }],
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
            },
          },
        })
        throw callbackFailure
      }),
    ).rejects.toBe(callbackFailure)

    const after = await withSharedTestDatabaseLease(
      payload,
      CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
      () =>
        payload.find({
          collection: 'consent',
          where: { key: { equals: 'lideranca-autopreenchimento' } },
          depth: 0,
          limit: 1,
        }),
    )
    expect(after.docs).toHaveLength(before.docs.length)
    if (after.docs[0]) {
      if (!snapshot) throw new Error('The mutable consent fixture must have provided a snapshot.')
      expect(after.docs[0]).toMatchObject({
        id: snapshot.id,
        key: snapshot.key,
        text: snapshot.text,
      })
    }

    const subsequent = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    await subsequent.release()
  })

  it('aggregates callback and restore lease acquisition failures in original order', async () => {
    const callbackFailure = new Error('intentional callback failure')
    const restoreAcquisitionFailure = new Error('intentional restore acquisition failure')
    // Private key: this fault skips the restore, so the committed-absent state
    // would leak for the rest of the run on a shared key (id churn in every
    // other file). A private key keeps the leak invisible.
    const faultKey = `restore-fault-${Date.now()}-${Math.random()}`
    const faultLeaseKey = `restore-fault-lease-${Date.now()}-${Math.random()}`

    const failure = await withMissingInviteConsentFixture(
      payload,
      async () => {
        throw callbackFailure
      },
      {
        consentKey: faultKey,
        leaseKey: faultLeaseKey,
        beforeRestoreLeaseAcquire: async () => {
          throw restoreAcquisitionFailure
        },
      },
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([callbackFailure, restoreAcquisitionFailure])
  })

  it('aggregates snapshot setup and setup lease release failures in original order', async () => {
    const snapshotFailure = new Error('intentional snapshot setup failure')
    const releaseFailure = new Error('intentional setup release failure')

    const failure = await withMissingInviteConsentFixture(payload, async () => undefined, {
      beforeSnapshotSetup: async () => {
        throw snapshotFailure
      },
      beforeSetupLeaseRelease: async () => {
        throw releaseFailure
      },
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([snapshotFailure, releaseFailure])

    const subsequent = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    await subsequent.release()
  })

  it('rolls back a failed missing-consent setup and preserves rollback errors', async () => {
    const before = await withInviteConsent(payload, async (consent) => consent)
    const releaseFailure = new Error('intentional setup release failure after deletion')
    const rollbackFailure = new Error('intentional setup rollback cleanup failure')
    let callbackCalled = false

    const failure = await withMissingInviteConsentFixture(
      payload,
      async () => {
        callbackCalled = true
      },
      {
        beforeSetupLeaseRelease: async () => {
          throw releaseFailure
        },
        beforeSetupLeaseRollback: async () => {
          throw rollbackFailure
        },
      },
    ).catch((error: unknown) => error)

    expect(callbackCalled).toBe(false)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([releaseFailure, rollbackFailure])
    const after = await withInviteConsent(payload, async (consent) => consent)
    // The rollback preserves the exact row; the text is not part of the
    // contract here (no restore ran, and a concurrent legitimate writer such
    // as the Onda0 provision may update it between reads).
    expect(after).toMatchObject({
      id: before.id,
      key: before.key,
    })

    const subsequent = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    await subsequent.release()
  })

  it('keeps an absent consent absent when missing-consent setup release fails', async () => {
    const consentKey = `absent-consent-${Date.now()}-${Math.random()}`
    const leaseKey = `absent-consent-lease-${Date.now()}-${Math.random()}`
    const releaseFailure = new Error('intentional absent setup release failure')
    const failure = await withMissingInviteConsentFixture(
      payload,
      async () => {
        throw new Error('callback must not run')
      },
      {
        consentKey,
        leaseKey,
        beforeSetupLeaseRelease: async () => {
          throw releaseFailure
        },
      },
    ).catch((error: unknown) => error)

    expect(failure).toBe(releaseFailure)
    const configured = await payload.find({
      collection: 'consent',
      where: { key: { equals: consentKey } },
      depth: 0,
      limit: 1,
    })
    expect(configured.docs).toHaveLength(0)

    const subsequent = await acquireTestDatabaseLease(payload, leaseKey)
    await subsequent.release()
  })

  it('purges orphaned consent renames left by an aborted run on ensure', async () => {
    // D10 F1: every consent fixture must clear the rename shapes an aborted
    // run can leave behind before snapshotting, or the next run's rename hits
    // the UNIQUE constraint. Legitimate rows (the private key below) survive.
    const privateKey = `purge-ensure-${Date.now()}-${Math.random()}`
    const privateLeaseKey = `purge-ensure-lease-${Date.now()}-${Math.random()}`
    const legitKey = `purge-legit-${Date.now()}-${Math.random()}`
    const orphanIDs: number[] = []
    let legitID = 0
    // The orphans are planted under the key's EXCLUSIVE lease: the rename
    // keys are LIVE inside other spec files' fixtures, and an unleased
    // create could hit their UNIQUE constraint mid-rename (D10 F2 load
    // measurement). The lease start also purges any leftover from a previous
    // failed run of this very test, so the plant never collides with it.
    const plantLease = await acquireTestDatabaseLease(payload, privateLeaseKey)
    try {
      await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
      for (const key of [
        'temporarily-renamed-consent',
        'chave-renomeada',
        'chave-temporariamente-ausente',
      ]) {
        const orphan = await payload.create({
          collection: 'consent',
          data: { key, text: fixtureConsentText },
          depth: 0,
        })
        orphanIDs.push(orphan.id)
      }
      const legit = await payload.create({
        collection: 'consent',
        data: { key: legitKey, text: fixtureConsentText },
        depth: 0,
      })
      legitID = legit.id
    } finally {
      await plantLease.release()
    }

    try {
      const configured = await ensureLeasedConsent(payload, {
        consentKey: privateKey,
        leaseKey: privateLeaseKey,
      })
      expect(configured.key).toBe(privateKey)

      for (const orphanID of orphanIDs) {
        const orphan = await payload.find({
          collection: 'consent',
          where: { id: { equals: orphanID } },
          depth: 0,
          limit: 1,
        })
        expect(orphan.docs).toHaveLength(0)
      }
      expect(
        await payload.findByID({ collection: 'consent', id: legitID, depth: 0 }),
      ).toMatchObject({ key: legitKey })
    } finally {
      // Cleanup runs even on failure — a failed run of this very test must
      // not leave the orphans it planted behind (self-healing tests).
      for (const orphanID of orphanIDs) {
        await payload
          .delete({ collection: 'consent', id: orphanID, depth: 0 })
          .catch(() => undefined)
      }
      if (legitID > 0) {
        await payload
          .delete({ collection: 'consent', id: legitID, depth: 0 })
          .catch(() => undefined)
      }
    }
  })

  it('purges orphaned renames during the missing-consent fixture setup', async () => {
    const privateKey = `purge-missing-${Date.now()}-${Math.random()}`
    const privateLeaseKey = `purge-missing-lease-${Date.now()}-${Math.random()}`
    // Planted under the exclusive lease (the rename keys are live inside
    // other spec files' fixtures — an unleased create could hit their UNIQUE
    // constraint mid-rename). The lease start also purges any leftover from
    // a previous failed run of this very test.
    const plantLease = await acquireTestDatabaseLease(payload, privateLeaseKey)
    let orphanID = 0
    try {
      await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
      orphanID = (
        await payload.create({
          collection: 'consent',
          data: { key: 'chave-temporariamente-ausente', text: fixtureConsentText },
          depth: 0,
        })
      ).id
    } finally {
      await plantLease.release()
    }

    await withMissingInviteConsentFixture(payload, async () => undefined, {
      consentKey: privateKey,
      leaseKey: privateLeaseKey,
    })

    try {
      const orphan = await payload.find({
        collection: 'consent',
        where: { id: { equals: orphanID } },
        depth: 0,
        limit: 1,
      })
      expect(orphan.docs).toHaveLength(0)
    } finally {
      // A failed run of this very test must not leave its plant behind.
      await payload.delete({ collection: 'consent', id: orphanID, depth: 0 }).catch(() => undefined)
    }
  })

  it('self-heals the canonical invite consent after an aborted rename on the next fixture run', async () => {
    // The exact residue an aborted run leaves: the canonical row committed
    // with a temporary key and the snapshot lost. The plant holds the
    // exclusive lease so parallel spec files never observe the state; the
    // fixture's own purge then heals it — the in-fixture rename must succeed
    // instead of hitting the UNIQUE `consent_key_idx`. The lease start also
    // purges any leftover from a previous failed run of this very test.
    const plantLease = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    try {
      await purgeOrphanedConsentRenames((query) => payload.db.drizzle.execute(query))
      const canonical = await payload.find({
        collection: 'consent',
        where: { key: { equals: 'lideranca-autopreenchimento' } },
        limit: 1,
        sort: 'id',
        depth: 0,
      })
      if (!canonical.docs[0]) {
        throw new Error(
          'The canonical invite consent row must exist before the aborted-rename repro.',
        )
      }
      await payload.update({
        collection: 'consent',
        id: canonical.docs[0].id,
        data: { key: 'chave-renomeada' },
        depth: 0,
      })
    } finally {
      await plantLease.release()
    }

    let renamedDuringFixture = false
    await withMutableConsentFixture(payload, async (consent) => {
      // Without the F1 purge this rename throws "Valor deve ser único".
      await payload.update({
        collection: 'consent',
        id: consent.id,
        data: { key: 'chave-renomeada' },
        depth: 0,
      })
      renamedDuringFixture = true
    })
    expect(renamedDuringFixture).toBe(true)

    // Second run proves the run following the healed one stays clean.
    await withMutableConsentFixture(payload, async () => undefined)

    const orphans = await payload.find({
      collection: 'consent',
      where: { key: { equals: 'chave-renomeada' } },
      depth: 0,
      pagination: false,
    })
    expect(orphans.totalDocs).toBe(0)
  })
})
