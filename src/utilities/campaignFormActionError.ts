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
