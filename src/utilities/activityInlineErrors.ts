/**
 * C91 — safe-message mapping for the agenda's inline quick create. Pure, so
 * both the server action and the unit tests share one source of truth: a DB
 * unique-title violation surfaces as a field error named like the full form's,
 * anything else collapses to a generic message.
 */
export const ACTIVITY_DUPLICATE_TITLE_MESSAGE = 'Já existe uma atividade com este título.'
export const ACTIVITY_INLINE_GENERIC_FAILURE_MESSAGE =
  'Não foi possível criar o compromisso. Tente novamente.'

export type ActivityInlineCreateErrorResult = {
  message: string
  fieldErrors?: Record<string, string[]>
}

export const mapActivityInlineCreateError = (error: unknown): ActivityInlineCreateErrorResult => {
  if (error instanceof Error && /já existe|unique|duplicate key/i.test(error.message)) {
    return {
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    }
  }
  return { message: ACTIVITY_INLINE_GENERIC_FAILURE_MESSAGE }
}
