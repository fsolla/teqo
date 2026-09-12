/**
 * C149 — pure pieces of the campaign's Google OAuth handshake. The authorize
 * URL is request-independent (client id + redirect uri + state are passed in),
 * so it lives in `lib/` and is unit-tested without a server. Nothing here is
 * secret: the client id is public in the consent URL and the state is
 * generated per attempt by the caller.
 */

const GOOGLE_CALENDAR_OAUTH_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

/** Where Google returns the browser after consent (also registered in the GCP client). */
export const GOOGLE_CALENDAR_OAUTH_CALLBACK_PATH = '/campanha/agenda/google-oauth/callback'

/**
 * The minimum scopes (C149 literal): `calendar.events` is what the mirror
 * needs to write, `calendar.calendarlist.readonly` is what C150's picker
 * needs to list the account's calendars. Nothing beyond.
 */
export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
] as const

type GoogleCalendarOAuthAuthorizeUrlInput = {
  clientId: string
  redirectUri: string
  state: string
}

export const buildGoogleCalendarOAuthAuthorizeUrl = ({
  clientId,
  redirectUri,
  state,
}: GoogleCalendarOAuthAuthorizeUrlInput): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_OAUTH_SCOPES.join(' '),
    // `offline` + `consent` are what make Google return a refresh token that
    // survives without weekly re-consent (the hard product constraint); the
    // explicit `prompt` also guarantees a fresh token on reconnect.
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_CALENDAR_OAUTH_AUTHORIZE_ENDPOINT}?${params.toString()}`
}
