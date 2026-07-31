// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  acquireSharedTestDatabaseLease,
  acquireTestDatabaseLease,
  CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
  ensureInviteConsent,
  startTestDatabaseLeaseAcquisition,
  waitForAdvisoryLockWaiter,
  withInviteConsent,
  withMissingInviteConsentFixture,
  withMutableConsentFixture,
  withSharedTestDatabaseLease,
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
    await withMissingInviteConsentFixture(payload, async () => {
      const ensured = await Promise.all([
        ensureInviteConsent(payload),
        ensureInviteConsent(payload),
        ensureInviteConsent(payload),
      ])
      const configured = await withSharedTestDatabaseLease(
        payload,
        CAMPAIGN_INVITE_CONSENT_LEASE_KEY,
        () =>
          payload.find({
            collection: 'consent',
            where: { key: { equals: 'lideranca-autopreenchimento' } },
            depth: 0,
            limit: 10,
          }),
      )

      expect(new Set(ensured.map((document) => document.id))).toHaveLength(1)
      expect(configured.docs).toHaveLength(1)
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
    const before = await withInviteConsent(payload, async (consent) => consent)

    await withMutableConsentFixture(payload, async (consent) => {
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

    await expect(
      withMutableConsentFixture(payload, async (consent) => {
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
    if (before.docs[0]) {
      expect(after.docs[0]).toMatchObject({
        id: before.docs[0].id,
        key: before.docs[0].key,
        text: before.docs[0].text,
      })
    } else {
      expect(after.docs).toHaveLength(0)
    }

    const subsequent = await acquireTestDatabaseLease(payload, CAMPAIGN_INVITE_CONSENT_LEASE_KEY)
    await subsequent.release()
  })

  it('aggregates callback and restore lease acquisition failures in original order', async () => {
    const callbackFailure = new Error('intentional callback failure')
    const restoreAcquisitionFailure = new Error('intentional restore acquisition failure')

    const failure = await withMissingInviteConsentFixture(
      payload,
      async () => {
        throw callbackFailure
      },
      {
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
    expect(after).toMatchObject({
      id: before.id,
      key: before.key,
      text: before.text,
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
})
