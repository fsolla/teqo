// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { getCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'

/**
 * The relying party decides whether biometric login (B40) is offered at all, and
 * getting it wrong is invisible until a real device throws mid-ceremony. The
 * three environments that matter are pinned here, the preview case above all.
 */
describe('getCampaignWebAuthnRelyingParty', () => {
  it('derives the RP from the canonical HTTPS origin in production', () => {
    expect(
      getCampaignWebAuthnRelyingParty({
        environment: 'production',
        configuredURL: 'https://pt.jorgesolla.com.br',
        forwardedHost: 'pt.jorgesolla.com.br',
        forwardedProto: 'https',
      }),
    ).toMatchObject({ rpID: 'pt.jorgesolla.com.br', origin: 'https://pt.jorgesolla.com.br' })
  })

  it('refuses a Vercel preview, where the served host is not the configured one', () => {
    // The invite policy answers with the canonical origin here — NODE_ENV is
    // production on a preview and NEXT_PUBLIC_SITE_URL is set — so without the
    // host comparison the button would mount and the browser would reject the
    // ceremony with a SecurityError.
    expect(
      getCampaignWebAuthnRelyingParty({
        environment: 'production',
        configuredURL: 'https://pt.jorgesolla.com.br',
        forwardedHost: 'teqo-git-b40-solla.vercel.app',
        forwardedProto: 'https',
      }),
    ).toBeNull()
  })

  it('follows the local port in development, so any pnpm dev works unconfigured', () => {
    expect(
      getCampaignWebAuthnRelyingParty({
        environment: 'development',
        configuredURL: undefined,
        forwardedHost: 'localhost:3100',
      }),
    ).toMatchObject({ rpID: 'localhost', origin: 'http://localhost:3100' })
  })

  it('refuses production without a configured site URL', () => {
    expect(
      getCampaignWebAuthnRelyingParty({ environment: 'production', configuredURL: undefined }),
    ).toBeNull()
  })
})
