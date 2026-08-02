import { redirect } from 'next/navigation'
import { ZodError } from 'zod'

import { FormDataBoundaryError, validationFieldErrors } from '@/lib/formData'

export type CampaignFormErrorState<Values> = {
  fieldErrors?: Record<string, string[]>
  message?: string
  values?: Values
  revision?: number
}

export type CampaignFormActionState = CampaignFormErrorState<undefined> & {
  status?: 'success'
}

export const CAMPAIGN_SESSION_EXPIRED_MESSAGE = 'Sessão expirada. Entre novamente.'
/**
 * Thrown when there is no campaign session at all. It is matched by exact
 * string in `safeMessages`, so a reworded throw would silently collapse a 401
 * into the generic message — hence the constant rather than the literal.
 */
export const CAMPAIGN_AUTH_REQUIRED_MESSAGE = 'Autenticação necessária.'

export type MapCampaignFormActionErrorOptions<Values> = {
  error: unknown
  safeMessages?: readonly string[]
  genericMessage: string
  values?: Values
  revision?: number
  resolveBoundaryMessage?: (error: FormDataBoundaryError) => string
}

export const mapCampaignFormActionError = <Values>(
  options: MapCampaignFormActionErrorOptions<Values>,
): CampaignFormErrorState<Values> => {
  const {
    error,
    safeMessages = [],
    genericMessage,
    values,
    revision,
    resolveBoundaryMessage,
  } = options

  if (error instanceof FormDataBoundaryError) {
    const message = resolveBoundaryMessage ? resolveBoundaryMessage(error) : error.message
    return { fieldErrors: { [error.field]: [message] }, values, revision }
  }
  if (error instanceof ZodError) {
    return { fieldErrors: validationFieldErrors(error), values, revision }
  }
  if (error instanceof Error && safeMessages.includes(error.message)) {
    return { message: error.message, values, revision }
  }
  return { message: genericMessage, values, revision }
}

/**
 * The shared stay-on-page form-action ladder: parse + mutate inside
 * `execute` (thrown `FormDataBoundaryError`/`ZodError`/safe messages map to
 * the standard error state), spread whatever `execute` resolves into the
 * success state (`message` plus extras like created ids). Pre-parsed `values`
 * and `revision` are echoed on failure so forms can repopulate.
 *
 * Documented exceptions that deliberately stay hand-rolled (allowlisted in
 * `codebaseConventions.unit.spec.ts`):
 * `atividades/formActions.ts` (custom unique-violation mapping + async
 * duplicate-title fallback), `apoiadores/[id]/formActions.ts` (flattens
 * field errors into message-only states for its inline controls),
 * `actions/auth.ts` and `actions/password.ts` (bespoke login/password flows).
 */
export const runCampaignFormAction = async <
  Success extends { message: string },
  Values = undefined,
>({
  execute,
  safeMessages,
  genericMessage,
  values,
  revision,
  resolveBoundaryMessage,
}: {
  execute: () => Promise<Success>
  safeMessages?: readonly string[]
  genericMessage: string
  /** Echoed back on failure so the form can repopulate. */
  values?: Values
  revision?: number
  resolveBoundaryMessage?: (error: FormDataBoundaryError) => string
}): Promise<({ status: 'success' } & Success) | CampaignFormErrorState<Values>> => {
  try {
    const success = await execute()
    return { ...success, status: 'success' as const }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages,
      genericMessage,
      values,
      revision,
      resolveBoundaryMessage,
    })
  }
}

/**
 * The shared create→redirect form-action ladder: run the mutation, map any
 * failure through `mapCampaignFormActionError`, redirect on success. The
 * redirect happens OUTSIDE the try so Next's control-flow error is never
 * swallowed by the mapper.
 */
export const runCampaignRedirectFormAction = async <Result>({
  execute,
  redirectTo,
  safeMessages,
  genericMessage,
}: {
  execute: () => Promise<Result>
  redirectTo: (result: Result) => string
  safeMessages?: readonly string[]
  genericMessage: string
}): Promise<CampaignFormActionState> => {
  let target: string
  try {
    target = redirectTo(await execute())
  } catch (error) {
    return mapCampaignFormActionError({ error, safeMessages, genericMessage })
  }

  redirect(target)
}
