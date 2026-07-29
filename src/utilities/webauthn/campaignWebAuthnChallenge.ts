import 'server-only'

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Window a browser has to complete a ceremony before the challenge cookie dies. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000

/**
 * A WebAuthn challenge only has to be unpredictable, single-use and short-lived
 * — it is not a secret the server must be able to look up later. So it rides in
 * an httpOnly cookie signed with `PAYLOAD_SECRET` (the `supporterImportToken`
 * pattern) instead of a `campaignWebAuthnChallenge` collection, which would
 * write a row every time somebody merely looks at the login screen and would
 * then need an expiry sweep.
 *
 * The ceremony kind is inside the signature, so a challenge minted for
 * enrollment cannot be spent on a login; the registration challenge is
 * additionally bound to the account that asked for it.
 */
export type CampaignWebAuthnCeremony = 'registration' | 'authentication'

const COOKIE_PATH = '/campanha'
const COOKIE_NAMES: Record<CampaignWebAuthnCeremony, string> = {
  registration: 'campaign-webauthn-registration',
  authentication: 'campaign-webauthn-authentication',
}

const getSecret = (): string => {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET não configurado para o desafio de biometria.')
  return secret
}

const signature = (
  ceremony: CampaignWebAuthnCeremony,
  challenge: string,
  expiresAt: number,
  subject: string,
): Buffer =>
  createHmac('sha256', getSecret())
    .update(`${ceremony}.${challenge}.${expiresAt}.${subject}`)
    .digest()

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  maxAge,
  path: COOKIE_PATH,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
})

/**
 * Stores the signed, time-boxed form of a challenge in the ceremony's cookie.
 *
 * The challenge itself is **minted by `@simplewebauthn/server`** and taken from
 * the generated `options.challenge`, rather than generated here and passed in:
 * `generateRegistrationOptions` treats a `string` challenge as UTF-8 text and
 * base64url-encodes it again before handing it to the browser, so signing our
 * own raw value would store one encoding and verify against another — which
 * failed every ceremony until it was measured (`Unexpected registration
 * response challenge`). Storing exactly what the browser will echo removes the
 * question.
 */
export const storeCampaignWebAuthnChallenge = async (
  ceremony: CampaignWebAuthnCeremony,
  challenge: string,
  subject: string = '',
): Promise<void> => {
  const expiresAt = Date.now() + CHALLENGE_TTL_MS
  const sig = signature(ceremony, challenge, expiresAt, subject).toString('base64url')

  const cookieStore = await cookies()
  cookieStore.set(
    COOKIE_NAMES[ceremony],
    `${challenge}.${expiresAt}.${sig}`,
    cookieOptions(Math.ceil(CHALLENGE_TTL_MS / 1000)),
  )
}

export const CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE =
  'A confirmação demorou demais. Tente novamente.'

/**
 * Reads back the challenge the browser is answering. Throws the expired message
 * for anything wrong — a missing, malformed, stale or forged cookie are the
 * same event from the user's side, and naming which one leaks nothing useful.
 */
export const readCampaignWebAuthnChallenge = async (
  ceremony: CampaignWebAuthnCeremony,
  subject: string = '',
): Promise<string> => {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAMES[ceremony])?.value

  const invalid = () => new Error(CAMPAIGN_WEBAUTHN_CHALLENGE_EXPIRED_MESSAGE)
  if (!raw) throw invalid()

  const [challenge, expiresAtText, sig, ...rest] = raw.split('.')
  if (!challenge || !expiresAtText || !sig || rest.length > 0) throw invalid()

  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) throw invalid()

  const expected = signature(ceremony, challenge, expiresAt, subject)
  const provided = Buffer.from(sig, 'base64url')
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw invalid()

  return challenge
}

/** Burns the challenge so a captured response cannot be replayed. */
export const clearCampaignWebAuthnChallenge = async (
  ceremony: CampaignWebAuthnCeremony,
): Promise<void> => {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAMES[ceremony], '', cookieOptions(0))
}
