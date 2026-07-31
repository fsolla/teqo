// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('notification access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('denies anonymous reads', async () => {
    await expect(
      payload.find({ collection: 'notification', overrideAccess: false }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('shows a recipient only their own notifications', async () => {
    const fixtures = campaignFixtures()
    const [owner, other] = await Promise.all([
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('advisor'),
    ])

    const own = await payload.create({
      collection: 'notification',
      data: {
        recipient: owner.id,
        type: 'municipality_update',
        payload: {
          title: 'Teste — Município',
          detail: 'Detalhe',
          href: '/campanha/municipios/teste',
        },
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'notification',
      data: {
        recipient: other.id,
        type: 'new_supporter',
        payload: {
          title: 'Outro',
          detail: 'Detalhe',
          href: '/campanha/apoiadores',
        },
      },
      overrideAccess: true,
    })

    const visible = await payload.find({
      collection: 'notification',
      depth: 0,
      user: owner,
      overrideAccess: false,
    })

    expect(visible.docs.map((doc) => doc.id)).toEqual([own.id])
  })
})

describe('pushSubscription access', () => {
  it('denies client-shaped subscription writes', async () => {
    const fixtures = campaignFixtures()
    const owner = await fixtures.createCampaignUser('advisor')

    await expect(
      payload.create({
        collection: 'pushSubscription',
        data: {
          user: owner.id,
          endpoint: 'https://push.example/1',
          p256dh: 'key',
          auth: 'auth',
          consent: 1,
          consentContentHash: 'hash',
          consentedAt: new Date().toISOString(),
        },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })
})
