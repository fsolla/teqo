/**
 * The always-loaded half of the browser side of WebAuthn (B40): the capability
 * probe and the error type. It imports nothing, which is the point —
 * `campaignWebAuthnClient.ts` pulls in `@simplewebauthn/browser` (~9 kB) and is
 * therefore only ever reached through a dynamic `import()` inside a handler, so
 * the ceremony code stays out of the First Load JS of every campaign route the
 * enrollment toast is mounted on.
 */

/**
 * A ceremony failure with a message already written for the person. Everything
 * else bubbles as a plain `Error` the island turns into its own fallback copy.
 */
export class CampaignWebAuthnError extends Error {
  /** True when the person simply closed the OS prompt — no alarm, no red. */
  readonly cancelled: boolean

  constructor(message: string, options: { cancelled?: boolean } = {}) {
    super(message)
    this.name = 'CampaignWebAuthnError'
    this.cancelled = options.cancelled ?? false
  }
}

/**
 * Whether this browser can complete a platform ceremony at all. Awaiting this
 * before rendering is what keeps a dead "Entrar com digital" button off a
 * desktop with no enrolled authenticator.
 */
export const canUseCampaignBiometrics = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    // A browser that refuses to answer the probe cannot host the ceremony.
    return false
  }
}
