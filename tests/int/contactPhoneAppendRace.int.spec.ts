// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { findOrCreateContactByPhone } from '@/utilities/contactIdentity'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('findOrCreateContactByPhone — concurrent append on one ficha (C120)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('never loses a typed phone when two flows reuse the same ficha by different primaries', async () => {
    const fixtures = campaignFixtures()
    const primaryA = fixtures.phone() // P1 — primary of flow A
    const primaryB = fixtures.phone() // P2 — primary of flow B
    const extraA = fixtures.phone() // P3 — only typed by flow A
    const extraB = fixtures.phone() // P4 — only typed by flow B

    // Plant the shared ficha: two numbers, so every flow resolves it by a
    // DIFFERENT primary (disjoint phone locks — the race the issue names).
    const ficha = await fixtures.createContact({
      name: fixtures.value('Ficha Compartilhada'),
      phones: [{ value: primaryA }, { value: primaryB }],
    })

    // Gate the two dedupe reads: hold flow A's find open until flow B's find
    // has ALSO read the pre-change array. Without the fix both flows append
    // from the same [P1,P2] snapshot and the last committer wins (3 phones).
    const originalFind = payload.find.bind(payload)
    let contactReads = 0
    let releaseFirstRead = () => {}
    const firstReadGate = new Promise<void>((resolve) => {
      releaseFirstRead = resolve
    })
    let markFirstRead = () => {}
    const firstReadReached = new Promise<void>((resolve) => {
      markFirstRead = resolve
    })
    let markSecondRead = () => {}
    const secondReadDone = new Promise<void>((resolve) => {
      markSecondRead = resolve
    })

    const findSpy = vi.spyOn(payload, 'find').mockImplementation(async (args) => {
      const result = await originalFind(args)
      const where =
        args.collection === 'contact' && 'where' in args
          ? (args.where as Record<string, unknown>)
          : {}
      const dedupeOn =
        typeof where['phones.value'] === 'object'
          ? (where['phones.value'] as Record<string, unknown>)['equals']
          : undefined
      if (typeof dedupeOn === 'string' && (dedupeOn === primaryA || dedupeOn === primaryB)) {
        contactReads += 1
        if (contactReads === 1) {
          markFirstRead()
          await firstReadGate
        } else if (contactReads === 2) {
          markSecondRead()
        }
      }
      return result
    })

    const flowA = withPayloadTransaction(payload, async ({ req }) =>
      findOrCreateContactByPhone({
        payload,
        req,
        phones: [primaryA, extraA],
        name: fixtures.value('Fluxo A'),
      }),
    )
    await firstReadReached

    const flowB = withPayloadTransaction(payload, async ({ req }) =>
      findOrCreateContactByPhone({
        payload,
        req,
        phones: [primaryB, extraB],
        name: fixtures.value('Fluxo B'),
      }),
    )
    await secondReadDone

    releaseFirstRead()

    const [resultA, resultB] = await Promise.allSettled([flowA, flowB])
    findSpy.mockRestore()

    expect(resultA.status).toBe('fulfilled')
    expect(resultB.status).toBe('fulfilled')
    if (resultA.status === 'fulfilled') {
      expect(resultA.value).toMatchObject({ contactID: ficha.id, reused: true })
    }
    if (resultB.status === 'fulfilled') {
      expect(resultB.value).toMatchObject({ contactID: ficha.id, reused: true })
    }

    const persisted = await payload.findByID({
      collection: 'contact',
      id: ficha.id,
      depth: 0,
      overrideAccess: true,
    })
    const finalPhones = (persisted.phones ?? [])
      .map((entry) => entry.value)
      .filter((value): value is string => Boolean(value))
      .sort()
    expect(finalPhones).toEqual([primaryA, primaryB, extraA, extraB].sort())
  })
})
