import 'server-only'

import { headers } from 'next/headers'

import {
  getCampaignInviteBaseURL,
  type CampaignInviteOriginInput,
} from '@/utilities/campaignInviteOrigin'

export type CampaignWebAuthnRelyingParty = {
  /** Effective domain the credential is scoped to (no port, no scheme). */
  rpID: string
  rpName: string
  /** Exact origin the browser must report in `clientDataJSON`. */
  origin: string
}

const RP_NAME = 'Campanha Jorge Solla'

/** Matches `LOCAL_AUTHORITY_PATTERN` in `campaignInviteOrigin` — kept local on purpose. */
const LOCAL_REQUEST_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i

const isLocalRequestHost = (host: string | undefined): boolean =>
  Boolean(host && LOCAL_REQUEST_HOST.test(host))

/**
 * The authority the browser is actually talking to, which is what has to agree
 * with the relying party. Compared as `host` (name + port) and not as a full
 * origin on purpose: a navigation carries no `Origin` header, so the scheme
 * would have to be guessed, and an http request to the production host cannot
 * reach a ceremony anyway — WebAuthn needs a secure context, so the browser
 * never exposes the API there.
 */
const requestHostOf = ({
  requestOrigin,
  forwardedHost,
}: CampaignInviteOriginInput): string | undefined => {
  const origin = requestOrigin?.trim()
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase()
    } catch {
      // Fall through to the forwarded host.
    }
  }

  const host = forwardedHost?.trim()
  return host ? host.toLowerCase() : undefined
}

/**
 * WebAuthn needs one fixed domain and one exact origin, so it reuses the
 * canonical-origin policy the invite links already own: production demands a
 * valid HTTPS DNS `NEXT_PUBLIC_SITE_URL` and fails closed, development and
 * test accept localhost.
 *
 * Returns `null` instead of throwing when this request cannot host a ceremony,
 * and there are two such cases. The obvious one is no safe origin at all. The
 * one that had to be measured is a **Vercel preview deployment**: `NODE_ENV` is
 * `production` there and `NEXT_PUBLIC_SITE_URL` is set, so the invite policy
 * happily returns the CANONICAL origin while the browser is on
 * `teqo-git-….vercel.app` — a mismatch the browser answers with a
 * `SecurityError` mid-ceremony. Hence the host comparison below: the RP is only
 * offered when it describes the origin actually serving the page, and the UI
 * reads `null` as "do not offer biometrics".
 */
export const getCampaignWebAuthnRelyingParty = (
  input: CampaignInviteOriginInput = {},
): CampaignWebAuthnRelyingParty | null => {
  const requestHost = requestHostOf(input)
  // `getCampaignInviteBaseURL` reads `process.env.NODE_ENV`, which Next inlines
  // at build time as `"production"`. CI e2e serves that build on
  // http://localhost:3000 (`pnpm start`), which would otherwise demand HTTPS
  // DNS and hide biometrics. The request host is authoritative here.
  const environment =
    input.environment ?? (isLocalRequestHost(requestHost) ? ('test' as const) : undefined)

  let baseURL: string
  try {
    baseURL = getCampaignInviteBaseURL(environment ? { ...input, environment } : input)
  } catch {
    return null
  }

  const url = new URL(baseURL)
  // Strip IPv6 brackets: `URL.hostname` keeps them, WebAuthn's RP ID must not.
  const rpID = url.hostname.replace(/^\[|\]$/g, '')

  // Absent host: a non-request context (a script, a test) that cannot be
  // checked. The ceremonies always pass the headers.
  if (requestHost && requestHost !== url.host.toLowerCase()) return null

  return { rpID, rpName: RP_NAME, origin: url.origin }
}

/**
 * Same resolution, reading the request headers so a local `pnpm dev` on any
 * port still works without `NEXT_PUBLIC_SITE_URL`. The forwarded values are
 * only ever honored for localhost authorities (see `campaignInviteOrigin`), so
 * production cannot be talked into a foreign relying party by a header.
 */
export const resolveCampaignWebAuthnRelyingParty =
  async (): Promise<CampaignWebAuthnRelyingParty | null> => {
    const requestHeaders = await headers()
    return getCampaignWebAuthnRelyingParty({
      requestOrigin: requestHeaders.get('origin'),
      forwardedHost: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
      forwardedProto: requestHeaders.get('x-forwarded-proto'),
    })
  }
