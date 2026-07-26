/**
 * CSRF guard for cookie-authenticated JSON route handlers (auto-save popovers):
 * a same-origin browser request either omits `Origin` (same-site navigation)
 * or sends one matching the request URL; anything else is rejected before the
 * body is even parsed. Shared by every `POST /campanha/**` JSON endpoint.
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
