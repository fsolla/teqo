// @vitest-environment node

import { jwtSign } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CAMPAIGN_SESSION_TTL_LONG, CAMPAIGN_SESSION_TTL_SHORT } from '@/lib/campaignSessionTtl'

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}))

import { CAMPAIGN_TOKEN_COOKIE, setCampaignAuthCookie } from '@/utilities/campaignAuth'

const secret = 'campaign-auth-test-secret'
const claims = {
  id: 42,
  collection: 'campaignUser',
  role: 'advisor',
  email: 'advisor@example.com',
  sid: 'session-id',
}
const payload = {
  secret,
}

const decodePayload = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >

describe('setCampaignAuthCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-signs the token and cookie to the short default while preserving auth claims', async () => {
    const { token } = await jwtSign({
      fieldsToSign: claims,
      secret,
      tokenExpiration: CAMPAIGN_SESSION_TTL_LONG,
    })

    await setCampaignAuthCookie(token, payload)

    const [name, shortToken, options] = mocks.cookieSet.mock.calls[0] ?? []
    const decoded = decodePayload(shortToken)
    expect(name).toBe(CAMPAIGN_TOKEN_COOKIE)
    expect(shortToken).not.toBe(token)
    expect(decoded).toMatchObject(claims)
    expect(Number(decoded.exp) - Number(decoded.iat)).toBe(CAMPAIGN_SESSION_TTL_SHORT)
    expect(options).toMatchObject({ maxAge: CAMPAIGN_SESSION_TTL_SHORT })
  })

  it('keeps a long Payload token unchanged when remember me is selected', async () => {
    const { token } = await jwtSign({
      fieldsToSign: claims,
      secret,
      tokenExpiration: CAMPAIGN_SESSION_TTL_LONG,
    })

    await setCampaignAuthCookie(token, payload, CAMPAIGN_SESSION_TTL_LONG)

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      CAMPAIGN_TOKEN_COOKIE,
      token,
      expect.objectContaining({ maxAge: CAMPAIGN_SESSION_TTL_LONG }),
    )
  })

  it('fails closed without setting a cookie when the token is malformed', async () => {
    await expect(setCampaignAuthCookie('not-a-jwt', payload)).rejects.toThrow(
      'Token de campanha inválido.',
    )
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })
})
