/**
 * B14 — browser geolocation for the `/campanha` field desk.
 *
 * The position never leaves the device: it is read here and matched against the
 * committed municipality mesh in the client, so there is no server action, no
 * PII at rest and no `Consent` key (same boundary as `recentVisits`).
 *
 * Sibling of `recentVisits.ts` on purpose — both are browser-storage/browser-API
 * clients, not Payload-coupled loaders.
 */

export const GEO_PROMPT_SESSION_KEY = 'teqo:campaign:geo-prompted-session'

/** Field networks are slow; past this the card offers the manual retry instead of spinning. */
const POSITION_TIMEOUT_MS = 10_000

/** A fix from the last few minutes still answers "which município am I in". */
const POSITION_MAX_AGE_MS = 5 * 60_000

/**
 * Above this reported radius the fix is a network/IP guess, not a device fix: on a
 * desk it can land tens of kilometres away, which is enough to name the wrong
 * município with total confidence. Surfaced as a caveat, never silently trusted.
 */
export const COARSE_ACCURACY_M = 10_000

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

type GeolocationFix = {
  lat: number
  lng: number
  /** Reported accuracy radius in metres — surfaced only to withhold false precision. */
  accuracyM: number
}

export type GeolocationFailureReason = 'unsupported' | 'denied' | 'unavailable' | 'timeout'

export type GeolocationResult =
  | { ok: true; fix: GeolocationFix }
  | { ok: false; reason: GeolocationFailureReason }

/**
 * Whether this tab already fired the automatic prompt. `sessionStorage` (not
 * `localStorage`) on purpose: a new session may legitimately ask again after the
 * user changes the permission in the OS, but one navigation inside the dashboard
 * must never re-prompt.
 */
export const hasPromptedThisSession = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(GEO_PROMPT_SESSION_KEY) === '1'
  } catch {
    // Private mode: treat as already prompted so the automatic path stays silent.
    return true
  }
}

export const markPromptedThisSession = (): void => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(GEO_PROMPT_SESSION_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Reads the permission without triggering a dialog. Safari shipped
 * `navigator.permissions` without the `geolocation` descriptor for years, so
 * `unknown` is a normal answer, not an error.
 */
export const readGeolocationPermissionState = async (): Promise<GeolocationPermissionState> => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return 'unknown'
  if (!navigator.permissions?.query) return 'unknown'

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unknown'
  }
}

const failureReasonFor = (error: GeolocationPositionError): GeolocationFailureReason => {
  if (error.code === error.PERMISSION_DENIED) return 'denied'
  if (error.code === error.TIMEOUT) return 'timeout'
  return 'unavailable'
}

/**
 * One position request, resolving to a typed result instead of throwing — every
 * failure mode is a rendered state in the card.
 *
 * High accuracy stays off: the answer is a município, and a GPS lock costs
 * seconds and battery for precision that changes nothing here.
 */
export const requestCurrentPosition = (): Promise<GeolocationResult> => {
  if (typeof window === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    return Promise.resolve({ ok: false, reason: 'unsupported' })
  }

  return new Promise<GeolocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          fix: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: position.coords.accuracy,
          },
        }),
      (error) => resolve({ ok: false, reason: failureReasonFor(error) }),
      {
        enableHighAccuracy: false,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: POSITION_MAX_AGE_MS,
      },
    )
  })
}
