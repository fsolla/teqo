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

const enrollPasskey = (userID: number, credentialId: string) =>
  payload.create({
    collection: 'campaignWebAuthnCredential',
    data: {
      user: userID,
      credentialId,
      publicKey: 'cHVibGljLWtleQ',
      counter: 0,
      deviceLabel: 'iPhone de teste',
    },
    overrideAccess: true,
  })

/**
 * A passkey is a login factor, so its row is the owner's business only — not
 * the coordinator's, not another advisor's. Payload's default access is "any
 * authenticated user", and a `campaign-token` JWT reaches
 * `/api/campaignWebAuthnCredential` directly, so every deny here has to be
 * explicit (roadmap B40).
 */
describe('campaignWebAuthnCredential access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('denies anonymous reads', async () => {
    await expect(
      payload.find({ collection: 'campaignWebAuthnCredential', overrideAccess: false }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('shows an owner only their own passkeys', async () => {
    const fixtures = campaignFixtures()
    const [owner, other] = await Promise.all([
      fixtures.createCampaignUser('leader'),
      fixtures.createCampaignUser('advisor'),
    ])
    const ownCredential = await enrollPasskey(owner.id, `own-${owner.id}`)
    await enrollPasskey(other.id, `other-${other.id}`)

    const visible = await payload.find({
      collection: 'campaignWebAuthnCredential',
      depth: 0,
      user: owner,
      overrideAccess: false,
    })

    expect(visible.docs.map((doc) => doc.id)).toEqual([ownCredential.id])
  })

  it('denies the coordinator reading or deleting another account passkey', async () => {
    const fixtures = campaignFixtures()
    const [owner, coordinator] = await Promise.all([
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('coordinator'),
    ])
    const credential = await enrollPasskey(owner.id, `owner-${owner.id}`)

    const visible = await payload.find({
      collection: 'campaignWebAuthnCredential',
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })
    expect(visible.docs).toHaveLength(0)

    await expect(
      payload.delete({
        collection: 'campaignWebAuthnCredential',
        id: credential.id,
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed|not found/i)

    await expect(
      payload.findByID({
        collection: 'campaignWebAuthnCredential',
        id: credential.id,
        depth: 0,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ id: credential.id })
  })

  it('lets the owner delete their own passkey', async () => {
    const fixtures = campaignFixtures()
    const owner = await fixtures.createCampaignUser('leader')
    const credential = await enrollPasskey(owner.id, `revoke-${owner.id}`)

    await payload.delete({
      collection: 'campaignWebAuthnCredential',
      id: credential.id,
      user: owner,
      overrideAccess: false,
    })

    await expect(
      payload.count({
        collection: 'campaignWebAuthnCredential',
        where: { user: { equals: owner.id } },
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ totalDocs: 0 })
  })

  it('refuses a client-shaped enrollment even by the owner', async () => {
    const fixtures = campaignFixtures()
    const owner = await fixtures.createCampaignUser('leader')

    await expect(
      payload.create({
        collection: 'campaignWebAuthnCredential',
        data: {
          user: owner.id,
          credentialId: `forged-${owner.id}`,
          publicKey: 'YXR0YWNrZXI',
          counter: 0,
          deviceLabel: 'Aparelho do atacante',
        },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('revokes the passkeys of a deleted account', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const doomed = await fixtures.createCampaignUser('advisor')
    await enrollPasskey(doomed.id, `doomed-${doomed.id}`)

    await payload.delete({
      collection: 'campaignUser',
      id: doomed.id,
      user: coordinator,
      overrideAccess: false,
    })

    await expect(
      payload.count({
        collection: 'campaignWebAuthnCredential',
        where: { user: { equals: doomed.id } },
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ totalDocs: 0 })
  })
})
