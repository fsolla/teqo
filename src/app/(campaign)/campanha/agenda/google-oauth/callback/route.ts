import config from '@payload-config'
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'

import { canManageGoogleCalendarConnection } from '@/utilities/access/googleCalendarSync'
import { getCampaignInviteBaseURL } from '@/utilities/campaignInviteOrigin'
import {
  buildGoogleCalendarOAuthRedirectUri,
  clearGoogleCalendarOAuthState,
  exchangeGoogleCalendarOAuthCode,
  GoogleCalendarOAuthError,
  readGoogleCalendarOAuthCredentials,
  readGoogleCalendarOAuthState,
} from '@/utilities/googleCalendarOAuth'
import {
  loadGoogleCalendarSyncConfig,
  recordGoogleCalendarOAuthConnection,
  recordGoogleCalendarOAuthError,
  runCampaignCalendarSync,
} from '@/utilities/googleCalendarSync'

/**
 * C149 — the OAuth callback registered in the GCP client. Google returns the
 * browser here after consent with `code + state` (or `error` when the user
 * denies). It lives OUTSIDE `(app)` on purpose: it is a ceremony route like
 * the WebAuthn ones, authenticated by the signed single-use state cookie and
 * not by a page session.
 *
 * The exchange is the only step that matters — the refresh token lands on the
 * singleton `googleCalendarSync` row and the derived connection state becomes
 * `connected`; a failure records `oauthError` so the UI offers reconnect. The
 * browser always ends on `/campanha/agenda` (no query param): the agenda page
 * canonicalizes unknown params away, so the state itself is the feedback.
 */

export const dynamic = 'force-dynamic'

/** The code exchange plus (when a calendar is configured) a full sync pass. */
export const maxDuration = 60

const AGENDA_PATH = '/campanha/agenda'

const agendaRedirect = (request: NextRequest): NextResponse => {
  try {
    return NextResponse.redirect(new URL(AGENDA_PATH, getCampaignInviteBaseURL()))
  } catch {
    // Only reachable when NEXT_PUBLIC_SITE_URL is missing in production —
    // still send the user back to the page instead of a dead end.
    return NextResponse.redirect(new URL(AGENDA_PATH, request.nextUrl.origin))
  }
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const payload = await getPayload({ config })
  const searchParams = request.nextUrl.searchParams
  const providedState = searchParams.get('state') ?? ''
  const errorParam = searchParams.get('error')
  const code = searchParams.get('code')

  try {
    // `access_denied` is the user saying no — not an error to surface, and
    // there is no code to exchange.
    if (errorParam || !code) {
      return agendaRedirect(request)
    }

    const state = await readGoogleCalendarOAuthState(providedState)
    // Burn before the exchange: a captured callback cannot be replayed even
    // if the exchange itself fails.
    await clearGoogleCalendarOAuthState()

    // Re-check the role against the FRESH document: the consent navigation
    // may have outlived a downgrade. The signed state binds the actor; the
    // role check is what authorizes the system write below. Intentional admin
    // bypass on the reload (the fresh-role read is the trusted check).
    const actor = await payload.findByID({
      collection: 'campaignUser',
      id: state.userId,
      depth: 0,
      overrideAccess: true,
    })
    if (!canManageGoogleCalendarConnection(actor)) {
      throw new GoogleCalendarOAuthError(
        'Apenas candidato ou coordenação pode conectar a conta Google da campanha.',
      )
    }

    const credentials = readGoogleCalendarOAuthCredentials()
    if (!credentials) {
      throw new GoogleCalendarOAuthError('A conexão com o Google não está configurada no servidor.')
    }

    // Only an EXCHANGE failure flips the connection state to `error` — a
    // refused role or a missing client env leaves the stored connection
    // untouched (the engine clears a transient exchange error on the next
    // successful pass with the previous token).
    const tokens = await exchangeGoogleCalendarOAuthCode({
      code,
      redirectUri: buildGoogleCalendarOAuthRedirectUri(),
      credentials,
    }).catch(async (error: unknown) => {
      if (error instanceof GoogleCalendarOAuthError) {
        await recordGoogleCalendarOAuthError(payload, error.message).catch(() => {})
      }
      throw error
    })

    await recordGoogleCalendarOAuthConnection(payload, {
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
    })

    const doc = await loadGoogleCalendarSyncConfig(payload)
    if (doc?.calendarId) {
      await runCampaignCalendarSync(payload, { reason: 'config-change' })
    }

    return agendaRedirect(request)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao conectar com o Google.'
    payload.logger.error(`[GoogleCalendarSync] Callback OAuth falhou: ${message}`)
    return agendaRedirect(request)
  } finally {
    await clearGoogleCalendarOAuthState().catch(() => {})
  }
}
