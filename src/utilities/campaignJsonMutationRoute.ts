import 'server-only'

import { NextResponse } from 'next/server'

import {
  CAMPAIGN_AUTH_REQUIRED_MESSAGE,
  CAMPAIGN_SESSION_EXPIRED_MESSAGE,
  mapCampaignFormActionError,
} from '@/utilities/campaignFormActionError'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

type CampaignJsonErrorBody = { status: 'error'; message: string }

/**
 * Structural on purpose: any zod schema satisfies it, and the shell stays out
 * of the validation library's type surface.
 */
type CampaignJsonBodySchema<TBody> = { parse: (value: unknown) => TBody }

type CampaignJsonMutationRouteConfig<TBody> = {
  bodySchema: CampaignJsonBodySchema<TBody>
  /** Domain messages allowed to reach the client verbatim (everything else collapses). */
  safeMessages: readonly string[]
  genericMessage: string
}

/** Parses the body, mapping a malformed one to a 400 every route shares. */
const parseCampaignJsonRequestBody = async (
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
const campaignJsonMutationErrorResponse = (
  error: unknown,
  { safeMessages, genericMessage }: { safeMessages: readonly string[]; genericMessage: string },
): NextResponse<CampaignJsonErrorBody> => {
  const mapped = mapCampaignFormActionError({
    error,
    safeMessages: [
      ...safeMessages,
      CAMPAIGN_AUTH_REQUIRED_MESSAGE,
      CAMPAIGN_SESSION_EXPIRED_MESSAGE,
    ],
    genericMessage,
  })

  const isAuthError =
    error instanceof Error &&
    (error.message === CAMPAIGN_AUTH_REQUIRED_MESSAGE ||
      error.message === CAMPAIGN_SESSION_EXPIRED_MESSAGE)

  return NextResponse.json(
    { status: 'error', message: mapped.message ?? genericMessage },
    { status: isAuthError ? 401 : 400 },
  )
}

/**
 * Builds the `POST` of a `/campanha/**` JSON mutation route (the list cells'
 * quick edits, and the WebAuthn ceremonies): same-origin check, body parse,
 * schema parse and error mapping, leaving each route with its schema, its
 * action call and its success payload.
 *
 * It is a wrapper and not a `guard(request)` helper because the origin check is
 * the kind of line a sixth route forgets, and forgetting it fails OPEN — a
 * cookie-authenticated POST from anywhere would be honoured. Here it is
 * structural: there is no way to export a handler that skipped it.
 * `tests/unit/codebaseConventions.unit.spec.ts` refuses a route that exports
 * `POST` without going through this.
 *
 * The schema is parsed inside the same `try` as the handler, so a malformed
 * field keeps mapping to the route's own `genericMessage`, as before.
 */
export const campaignJsonMutationRoute =
  <TBody, TResponse>(
    config: CampaignJsonMutationRouteConfig<TBody>,
    handler: (body: TBody) => Promise<NextResponse<TResponse>>,
  ) =>
  async (request: Request): Promise<NextResponse<TResponse | CampaignJsonErrorBody>> => {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { status: 'error', message: 'Requisição inválida.' },
        { status: 403 },
      )
    }

    const parsed = await parseCampaignJsonRequestBody(request)
    if (!parsed.ok) return parsed.response

    try {
      return await handler(config.bodySchema.parse(parsed.body))
    } catch (error) {
      return campaignJsonMutationErrorResponse(error, config)
    }
  }
