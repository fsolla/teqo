import 'server-only'

import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'

/**
 * CSRF guard for cookie-authenticated JSON route handlers (auto-save popovers):
 * a same-origin browser request either omits `Origin` (same-site navigation)
 * or sends one matching an origin this deployment answers as. Two bases are
 * accepted, and both must hold for every consumer:
 *
 * - the literal `request.url` base — what a browser sends when it reaches this
 *   server directly (dev, worktrees, direct TLS);
 * - the proxy-aware public base resolved with the established
 *   `getCampaignInviteBaseURL` policy (`x-forwarded-*` for local authorities,
 *   `NEXT_PUBLIC_SITE_URL` — HTTPS public DNS or throw — in production). This
 *   is what a browser sends behind the Cloudflare tunnel, where `request.url`
 *   still carries the internal `http://localhost:3000` origin.
 *
 * Resolving the second base can throw (production misconfiguration); the
 * failure is contained to that base so the decision falls to the first.
 * Anything that matches neither is rejected before the body is even parsed.
 *
 * The `Origin` under verification doubles as the resolver's `requestOrigin`
 * input: production ignores it (the configured site URL decides), while
 * dev/test accept any localhost/127.0.0.1/[::1] port through it — a dev-only
 * relaxation, never a production one.
 *
 * Every `POST /campanha/**` endpoint inherits this through
 * `campaignJsonMutationRoute`; the two remaining JSON routes
 * (`campanha/api/ai-transcribe`, `api/social-feed/sync`) call it directly and
 * keep their own rejection envelopes.
 */
export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return true

  let originURL: URL
  try {
    originURL = new URL(origin)
  } catch {
    return false
  }

  try {
    if (originURL.origin === new URL(request.url).origin) return true
  } catch {
    return false
  }

  try {
    return (
      originURL.origin ===
      new URL(
        getCampaignInviteBaseURL({
          requestOrigin: origin,
          forwardedHost: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
          forwardedProto: request.headers.get('x-forwarded-proto'),
        }),
      ).origin
    )
  } catch {
    return false
  }
}
