// @vitest-environment node

import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { getPayload } from 'payload'

import {
  STAGING_TEST_ACCOUNT,
  upsertStagingTestAccount,
} from '../../scripts/lib/staging-test-account.mjs'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/**
 * The account's synthetic `Contact` is materialized by the collection hook on
 * the root payload (not the fixture proxy), so it is not auto-owned. Own it
 * explicitly or every run leaves an orphan ficha behind.
 */
const ownAccount = async (id: number) => {
  campaignFixtures().own('campaignUser', id)
  const doc = await payload.findByID({ collection: 'campaignUser', id, depth: 0 })
  if (typeof doc.contact === 'number') campaignFixtures().own('contact', doc.contact)
  return doc
}

describe('staging test account bootstrap (OPS125)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('upserts the account idempotently and logs in by email', async () => {
    const password = campaignFixtures().value('staging-password')

    const first = await upsertStagingTestAccount(campaignFixtures().payload, { password })
    const doc = await ownAccount(first.id)

    const second = await upsertStagingTestAccount(campaignFixtures().payload, { password })
    expect(second.id).toBe(first.id)

    const accounts = await payload.find({
      collection: 'campaignUser',
      where: { email: { equals: STAGING_TEST_ACCOUNT.email } },
      depth: 0,
      pagination: false,
    })
    expect(accounts.docs).toHaveLength(1)

    const login = await payload.login({
      collection: 'campaignUser',
      data: { email: STAGING_TEST_ACCOUNT.email, password },
    })
    expect(typeof login.token).toBe('string')
    expect(login.token?.length).toBeGreaterThan(20)
    expect(login.user?.role).toBe('coordinator')
    // login hydrates the relationship; compare the resolved id to the owned ficha.
    expect(campaignFixtures().id(login.user!.contact!)).toBe(doc.contact)
  })

  it('syncs the identity and password on a re-run', async () => {
    const password = campaignFixtures().value('staging-password')
    const rotated = `${password}-rotated`

    const created = await upsertStagingTestAccount(campaignFixtures().payload, { password })
    await ownAccount(created.id)

    const updated = await upsertStagingTestAccount(campaignFixtures().payload, {
      password: rotated,
    })
    expect(updated).toEqual({ operation: 'updated', id: created.id })

    await expect(
      payload.login({
        collection: 'campaignUser',
        data: { email: STAGING_TEST_ACCOUNT.email, password },
      }),
    ).rejects.toThrow()
    const rotatedLogin = await payload.login({
      collection: 'campaignUser',
      data: { email: STAGING_TEST_ACCOUNT.email, password: rotated },
    })
    expect(rotatedLogin.user?.name).toBe(STAGING_TEST_ACCOUNT.name)
  })
})
