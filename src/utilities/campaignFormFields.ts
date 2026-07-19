export const fieldError = (
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined => fieldErrors?.[field]?.[0]

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
