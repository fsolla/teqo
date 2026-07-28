// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A fake cookie jar, because the challenge is deliberately NOT a database row:
 * the signature and the TTL in the cookie are the whole mechanism, so they are
 * what has to be pinned.
 */
const mocks = vi.hoisted(() => {
  const jar = new Map<string, string>()
  return {
    jar,
    cookies: vi.fn(async () => ({
      get: (name: string) => {
        const value = jar.get(name)
        return value === undefined ? undefined : { name, value }
      },
      set: (name: string, value: string) => {
        jar.set(name, value)
      },
    })),
  }
})

vi.mock('next/headers', () => ({ cookies: mocks.cookies }))

import {
  CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
  clearCampaignWebAuthnChallenge,
  readCampaignWebAuthnChallenge,
  storeCampaignWebAuthnChallenge,
} from '@/utilities/campaignWebAuthnChallenge'

const CHALLENGE = 'Zm9vYmFyLWNoYWxsZW5nZS1iYXNlNjR1cmw'

describe('campaign WebAuthn challenge cookie', () => {
  beforeEach(() => {
    mocks.jar.clear()
    process.env.PAYLOAD_SECRET = 'webauthn-challenge-test-secret'
  })

  it('reads back the exact value the browser will echo', async () => {
    await storeCampaignWebAuthnChallenge('authentication', CHALLENGE)

    await expect(readCampaignWebAuthnChallenge('authentication')).resolves.toBe(CHALLENGE)
  })

  it('refuses a challenge minted for the other ceremony', async () => {
    await storeCampaignWebAuthnChallenge('registration', CHALLENGE, '7')

    // Not merely a different cookie: the ceremony is inside the signature, so
    // even a copied cookie value cannot be spent on the other flow.
    await expect(readCampaignWebAuthnChallenge('authentication')).rejects.toThrow(
      CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
    )
  })

  it('refuses a registration challenge read for a different account', async () => {
    await storeCampaignWebAuthnChallenge('registration', CHALLENGE, '7')

    await expect(readCampaignWebAuthnChallenge('registration', '8')).rejects.toThrow(
      CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
    )
  })

  it('refuses a tampered challenge, expiry or signature', async () => {
    await storeCampaignWebAuthnChallenge('authentication', CHALLENGE)
    const [challenge, expiresAt, signature] = (
      mocks.jar.get('campaign-webauthn-authentication') ?? ''
    ).split('.') as [string, string, string]

    for (const forged of [
      `${challenge}x.${expiresAt}.${signature}`,
      // Pushing the expiry out is the attack the signature exists to stop.
      `${challenge}.${Number(expiresAt) + 60_000}.${signature}`,
      `${challenge}.${expiresAt}.${signature.slice(0, -2)}`,
      challenge,
    ]) {
      mocks.jar.set('campaign-webauthn-authentication', forged)
      await expect(readCampaignWebAuthnChallenge('authentication')).rejects.toThrow(
        CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
      )
    }
  })

  it('refuses an expired challenge', async () => {
    vi.useFakeTimers()
    try {
      await storeCampaignWebAuthnChallenge('authentication', CHALLENGE)
      vi.advanceTimersByTime(6 * 60 * 1000)

      await expect(readCampaignWebAuthnChallenge('authentication')).rejects.toThrow(
        CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('is single use once cleared', async () => {
    await storeCampaignWebAuthnChallenge('authentication', CHALLENGE)
    await clearCampaignWebAuthnChallenge('authentication')

    await expect(readCampaignWebAuthnChallenge('authentication')).rejects.toThrow(
      CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE,
    )
  })
})
