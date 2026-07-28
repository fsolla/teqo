export const fieldError = (
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined => fieldErrors?.[field]?.[0]

/**
 * Flatten a form-action failure state to ONE message for controls that render
 * a single line (suggestion cards, chip cells, the supporter intention
 * control): the top-level message when the action set one, otherwise the
 * first non-empty field error.
 */
export const firstFormActionMessage = (state: {
  message?: string
  fieldErrors?: Record<string, string[]>
}): string | undefined => {
  if (state.message) return state.message
  return Object.values(state.fieldErrors ?? {})
    .flat()
    .find((message) => message.length > 0)
}

export const errorProps = (
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
  idPrefix: string,
): {
  error: string | undefined
  invalid: boolean
  describedBy: string | undefined
} => {
  const error = fieldError(fieldErrors, field)
  return {
    error,
    invalid: Boolean(error),
    describedBy: error ? `${idPrefix}-${field}-error` : undefined,
  }
}
