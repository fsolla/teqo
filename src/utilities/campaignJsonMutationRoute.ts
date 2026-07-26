import { NextResponse } from 'next/server'

import {
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
} from '@/utilities/campaignFormActionError'

export type CampaignJsonErrorBody = { status: 'error'; message: string }

/**
 * Shared shell for `POST /campanha/**` JSON mutation routes (list-popover
 * auto-save): parses the body, mapping a malformed one to the same 400 both
 * routes already used. Domain parsing/success payloads stay per-route.
 */
export const parseCampaignJsonRequestBody = async (
  request: Request,
): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse<CampaignJsonErrorBody> }
> => {
  try {
    return { ok: true, body: await request.json() }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { status: 'error', message: 'Corpo da requisição inválido.' },
        { status: 400 },
      ),
    }
  }
}

/**
 * Maps a thrown error to the JSON error response: safe messages (incl. the
 * two auth ones, appended once here) pass through as 400, an expired/missing
 * session is 401, anything else collapses to `genericMessage`.
 */
export const campaignJsonMutationErrorResponse = (
  error: unknown,
  { safeMessages, genericMessage }: { safeMessages: readonly string[]; genericMessage: string },
): NextResponse<CampaignJsonErrorBody> => {
  const mapped = mapCampaignFormActionError({
    error,
    safeMessages: [...safeMessages, 'Autenticação necessária.', CAMPAIGN_SESSION_EXPIRED_MESSAGE],
    genericMessage,
  })

  const isAuthError =
    error instanceof Error &&
    (error.message === 'Autenticação necessária.' ||
      error.message === CAMPAIGN_SESSION_EXPIRED_MESSAGE)

  return NextResponse.json(
    { status: 'error', message: mapped.message ?? genericMessage },
    { status: isAuthError ? 401 : 400 },
  )
}
