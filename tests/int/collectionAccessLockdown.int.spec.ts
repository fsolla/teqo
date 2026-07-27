// @vitest-environment node

import {
  getPayload,
  type Payload,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createLeaderSupporterRecord } from '@/app/(campaign)/campanha/actions/leaderSupporter'
import { Media } from '@/collections/Media'
import { Post } from '@/collections/Post'
import { Tag } from '@/collections/Tag'
import config from '@/payload.config'
import { canManagePublishedContent } from '@/utilities/access/shared'
import { SUPPORTER_REGISTRATION_CONSENT_KEY } from '@/utilities/campaignConsent'
import { relationshipId } from '@/utilities/relationship'

import { installCampaignFixtures } from '../helpers/campaignFixtures'
import { stub } from '../helpers/stub'
import {
  SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
  withLeasedConsent,
} from '../helpers/testDatabaseLease'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/** Runs `operation` with the shared supporter-registration consent guaranteed present. */
const withSupporterRegistrationConsent = <Result>(
  operation: () => Promise<Result>,
): Promise<Result> =>
  withLeasedConsent(
    payload,
    {
      consentKey: SUPPORTER_REGISTRATION_CONSENT_KEY,
      leaseKey: SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
    },
    operation,
  )

/**
 * Collections without explicit `access` fall back to Payload's "any
 * authenticated user" default — which includes campaign users presenting the
 * `campaign-token` JWT against `/api/*`. These tests pin the lockdown added to
 * the CMS/PII collections: campaign users (even the coordinator) must be
 * denied, admins keep working, and the public keeps read-only access where
 * intended.
 */
describe('CMS/PII collection access lockdown', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('denies campaign users any access to admin accounts (users)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    await expect(
      payload.count({ collection: 'users', where: {}, user: coordinator, overrideAccess: false }),
    ).rejects.toThrow(/permissão|not allowed/i)

    await expect(
      payload.create({
        collection: 'users',
        data: {
          email: 'escalated@example.com',
          password: 'owned-by-attacker',
          roles: ['admin'],
        },
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('lets admin users keep managing the users collection', async () => {
    const fixtures = campaignFixtures()
    const admin = await fixtures.createAdminUser()

    expect(admin.roles).toEqual(['admin'])

    const result = await payload.count({
      collection: 'users',
      where: { id: { equals: admin.id } },
      user: admin,
      overrideAccess: false,
    })
    expect(result.totalDocs).toBe(1)
  })

  it('lets editors enter the panel for published content but denies PII and campaign data', async () => {
    const fixtures = campaignFixtures()
    const editor = await fixtures.createEditorUser()
    expect(editor.roles).toEqual(['editor'])

    // Call access directly — creating a Tag would hit revalidateTag outside Next.
    for (const collection of [Tag, Post, Media]) {
      expect(collection.access?.create).toBe(canManagePublishedContent)
    }
    expect(
      canManagePublishedContent({
        req: stub<PayloadRequest>({ user: editor }),
      }),
    ).toBe(true)

    await expect(
      payload.count({
        collection: 'users',
        where: {},
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)

    for (const collection of [
      'signature',
      'subscription',
      'consent',
      'contact',
      'municipality',
    ] as const) {
      await expect(
        payload.count({ collection, where: {}, user: editor, overrideAccess: false }),
      ).rejects.toThrow(/permissão|not allowed/i)
    }

    await expect(
      payload.create({
        collection: 'petition',
        data: stub<RequiredDataFromCollectionSlug<'petition'>>({}),
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('lets an editor read and update their own users account but not escalate roles', async () => {
    const fixtures = campaignFixtures()
    const password = fixtures.value('password')
    const editor = await fixtures.createEditorUser({ password })

    const self = await payload.findByID({
      collection: 'users',
      id: editor.id,
      user: editor,
      overrideAccess: false,
      depth: 0,
    })
    expect(self.id).toBe(editor.id)
    expect(self.roles).toEqual(['editor'])

    await expect(
      payload.update({
        collection: 'users',
        id: editor.id,
        data: { roles: ['admin', 'editor'] },
        user: editor,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow(/inválido|permissão|not allowed|Papéis/i)

    const afterEscalate = await payload.findByID({
      collection: 'users',
      id: editor.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterEscalate.roles).toEqual(['editor'])

    // Anti-lockout: payload.auth must return the document with roles populated.
    // If req.user were JWT claims alone, isPayloadAdmin would deny every admin.
    const login = await payload.login({
      collection: 'users',
      data: { email: editor.email, password },
    })
    expect(login.user).toBeDefined()
    expect(login.user?.roles).toEqual(['editor'])

    const { user: authed } = await payload.auth({
      headers: new Headers({ Authorization: `JWT ${login.token}` }),
    })
    expect(authed?.collection).toBe('users')
    expect(authed && 'roles' in authed ? authed.roles : undefined).toEqual(['editor'])
  })

  it.each(['signature', 'subscription', 'consent'] as const)(
    'denies campaign users and anonymous requests access to %s (PII/legal)',
    async (collection) => {
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')

      await expect(
        payload.count({ collection, where: {}, user: coordinator, overrideAccess: false }),
      ).rejects.toThrow(/permissão|not allowed/i)

      await expect(payload.count({ collection, where: {}, overrideAccess: false })).rejects.toThrow(
        /permissão|not allowed/i,
      )
    },
  )

  it('lets admin users keep reading signatures and subscriptions', async () => {
    const fixtures = campaignFixtures()
    const admin = await fixtures.createAdminUser()

    await expect(
      payload.count({ collection: 'signature', where: {}, user: admin, overrideAccess: false }),
    ).resolves.toMatchObject({ totalDocs: expect.any(Number) })
    await expect(
      payload.count({ collection: 'subscription', where: {}, user: admin, overrideAccess: false }),
    ).resolves.toMatchObject({ totalDocs: expect.any(Number) })
  })

  it.each(['post', 'tag', 'petition', 'media'] as const)(
    'denies campaign users create access to public-content collection %s',
    async (collection) => {
      const coordinator = await campaignFixtures().createCampaignUser('coordinator')

      await expect(
        payload.create({
          collection,
          // Denied before validation: an empty payload stands in for required fields.
          data: stub<RequiredDataFromCollectionSlug<typeof collection>>({}),
          user: coordinator,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/permissão|not allowed/i)
    },
  )

  it.each(['post', 'tag', 'petition', 'media'] as const)(
    'keeps anonymous read access to public-content collection %s',
    async (collection) => {
      await expect(
        payload.count({ collection, where: {}, overrideAccess: false }),
      ).resolves.toMatchObject({ totalDocs: expect.any(Number) })
    },
  )
})

describe('leader supporter creation scope', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('lets an engaged leader register a supporter in a linked municipality', async () => {
    const fixtures = campaignFixtures()
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const leaderContact = await fixtures.createContact()
    const linked = await fixtures.getMunicipality()
    await fixtures.createLeadership({
      contact: leaderContact.id,
      municipalities: [linked.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    const supporter = await withSupporterRegistrationConsent(() =>
      createLeaderSupporterRecord(payload, leaderAccount, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        city: 'Salvador',
        municipality: linked.id,
        consentAccepted: true,
      }),
    )
    fixtures.own('supporter', supporter.id)

    expect(supporter.source).toBe('lideranca')
    expect(relationshipId(supporter.createdBy)).toBe(leaderAccount.id)
    expect(relationshipId(supporter.municipality)).toBe(linked.id)
  })

  it('rejects a supporter outside the leadership municipalities', async () => {
    const fixtures = campaignFixtures()
    const leaderAccount = await fixtures.createCampaignUser('leader')
    const leaderContact = await fixtures.createContact()
    const linked = await fixtures.getMunicipality()
    const outside = await fixtures.getMunicipality()
    await fixtures.createLeadership({
      contact: leaderContact.id,
      municipalities: [linked.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })

    await expect(
      withSupporterRegistrationConsent(() =>
        createLeaderSupporterRecord(payload, leaderAccount, {
          name: fixtures.value('Apoiador'),
          phone: fixtures.phone(),
          city: 'Salvador',
          municipality: outside.id,
          consentAccepted: true,
        }),
      ),
    ).rejects.toThrow('Você só pode cadastrar contatos nos municípios da sua liderança.')
  })

  it('rejects staff accounts on the leader-only contact tool', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()

    await expect(
      createLeaderSupporterRecord(payload, advisor, {
        name: fixtures.value('Apoiador'),
        phone: fixtures.phone(),
        city: 'Salvador',
        municipality: municipality.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow('Somente lideranças podem cadastrar contatos por aqui.')
  })
})
