import { ZodError } from 'zod'

import { FormDataBoundaryError, validationFieldErrors } from '@/lib/formData'

export type CampaignFormErrorState<Values> = {
  fieldErrors?: Record<string, string[]>
  message?: string
  values?: Values
  revision?: number
}

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
