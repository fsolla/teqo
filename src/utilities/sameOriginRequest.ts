/**
 * CSRF guard for cookie-authenticated JSON route handlers (auto-save popovers):
 * a same-origin browser request either omits `Origin` (same-site navigation)
 * or sends one matching the request URL; anything else is rejected before the
 * body is even parsed. Its single consumer is `campaignJsonMutationRoute`,
 * which is how every `POST /campanha/**` endpoint gets it: applying the policy
 * here and the sharing there is what stops a new route from omitting it.
 */
export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}
