// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { assert, beforeAll, describe, expect, it } from 'vitest'

import { CAMPAIGN_SESSION_TTL_LONG } from '@/lib/campaignSessionTtl'
import config from '@/payload.config'
import { authenticateCampaignToken } from '@/utilities/campaignAuth'
import {
  CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
  CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
  issueCampaignWebAuthnSession,
} from '@/utilities/campaignWebAuthnSession'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const decodeClaims = (token: string): Record<string, unknown> => {
  const segment = token.split('.')[1]
  assert(segment)
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>
}

/**
 * The stored session rows. `payload.findByID` runs `removePrivateAuthFields`
 * and Payload strips `sessions` from an unauthenticated read anyway, so the
 * assertion goes straight at the table.
 */
const readSessions = async (userID: number): Promise<unknown[]> => {
  const result = await payload.db.drizzle.execute(
    sql`SELECT id FROM campaign_user_sessions WHERE _parent_id = ${userID}`,
  )
  return result.rows
}

/**
 * Pins the password-less session mint (roadmap B40). The dangerous part is not
 * the crypto — `@simplewebauthn/server` owns that — it is that
 * `addSessionToUser` rewrites the whole user document, so a mint built on
 * `payload.findByID` would silently sign the account out everywhere else.
 */
describe('campaign WebAuthn session mint', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('mints a token that authenticates as the user, with the 14-day TTL', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')

    const { token, tokenExpiration } = await issueCampaignWebAuthnSession(payload, advisor.id)

    expect(tokenExpiration).toBe(CAMPAIGN_SESSION_TTL_LONG)

    const authenticated = await authenticateCampaignToken(token, payload)
    expect(authenticated).toMatchObject({ id: advisor.id, role: 'advisor' })

    const claims = decodeClaims(token)
    expect(claims).toMatchObject({ collection: 'campaignUser', id: advisor.id, role: 'advisor' })
    expect(claims.sid).toEqual(expect.any(String))
    // JWT `exp` and the cookie `maxAge` are the same 14 days, so the cookie is
    // never left holding a token the server already rejects.
    expect(Number(claims.exp) - Number(claims.iat)).toBe(CAMPAIGN_SESSION_TTL_LONG)
  })

  it('keeps every other session of the account alive', async () => {
    const fixtures = campaignFixtures()
    const password = fixtures.value('password')
    const email = `${fixtures.value('passkey-mint')}@example.com`
    const user = await payload.create({
      collection: 'campaignUser',
      data: { name: 'Assessoria com dois aparelhos', email, password, role: 'advisor' },
    })
    fixtures.own('campaignUser', user)

    const passwordLogin = await payload.login({
      collection: 'campaignUser',
      data: { email, password },
    })
    assert(passwordLogin.token)

    const { token: passkeyToken } = await issueCampaignWebAuthnSession(payload, user.id)

    // The mine: the password session must survive the passkey login.
    await expect(authenticateCampaignToken(passwordLogin.token, payload)).resolves.toMatchObject({
      id: user.id,
    })
    await expect(authenticateCampaignToken(passkeyToken, payload)).resolves.toMatchObject({
      id: user.id,
    })
    expect(await readSessions(user.id)).toHaveLength(2)
  })

  it('does not disturb the account document it writes back', async () => {
    const fixtures = campaignFixtures()
    const password = fixtures.value('password')
    const email = `${fixtures.value('passkey-writeback')}@example.com`
    const user = await payload.create({
      collection: 'campaignUser',
      data: { name: 'Assessoria intacta', email, password, role: 'advisor' },
    })
    fixtures.own('campaignUser', user)

    const before = await payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })

    await issueCampaignWebAuthnSession(payload, user.id)

    const after = await payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after).toMatchObject({
      name: before.name,
      role: before.role,
      username: before.username,
      email: before.email,
      // Payload deliberately skips the `updatedAt` bump for a login.
      updatedAt: before.updatedAt,
    })
    // The password still works: the write-back goes through `update`, which is
    // the operation that could blank the hash it never reads.
    await expect(
      payload.login({ collection: 'campaignUser', data: { email, password } }),
    ).resolves.toMatchObject({ user: { id: user.id } })
  })

  it('refuses a locked account instead of letting biometrics bypass the lockout', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('advisor')

    await payload.update({
      collection: 'campaignUser',
      id: user.id,
      data: { lockUntil: new Date(Date.now() + 60_000).toISOString() },
      overrideAccess: true,
    })

    await expect(issueCampaignWebAuthnSession(payload, user.id)).rejects.toThrow(
      CAMPAIGN_WEBAUTHN_ACCOUNT_LOCKED_MESSAGE,
    )
    expect(await readSessions(user.id)).toHaveLength(0)
  })

  it('refuses an account that no longer exists', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('leader')
    await payload.delete({ collection: 'campaignUser', id: user.id, overrideAccess: true })

    await expect(issueCampaignWebAuthnSession(payload, user.id)).rejects.toThrow(
      CAMPAIGN_WEBAUTHN_ACCOUNT_UNAVAILABLE_MESSAGE,
    )
  })

  it('serializes concurrent mints so neither loses the other session', async () => {
    const fixtures = campaignFixtures()
    const user = await fixtures.createCampaignUser('advisor')

    const [first, second] = await Promise.all([
      issueCampaignWebAuthnSession(payload, user.id),
      issueCampaignWebAuthnSession(payload, user.id),
    ])

    await expect(authenticateCampaignToken(first.token, payload)).resolves.toMatchObject({
      id: user.id,
    })
    await expect(authenticateCampaignToken(second.token, payload)).resolves.toMatchObject({
      id: user.id,
    })
    expect(await readSessions(user.id)).toHaveLength(2)
  })
})
