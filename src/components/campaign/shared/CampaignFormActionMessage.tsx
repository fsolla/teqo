import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'

export type CampaignFormActionFeedbackState = {
  status?: string
  message?: string
}

/**
 * THE form-action feedback renderer (P3-G): every `{state.message && …}` JSX
 * spelled by hand was mute for assistive tech in 10 of 15 sites. This
 * primitive owns the `aria-live` region so adoption IS the prevention — the
 * convention guard in `codebaseConventions.unit.spec.ts` fails the build on
 * the raw spelling outside it.
 *
 * Error: destructive Alert, optional title. Success: default Alert with the
 * action's message (or the given fallback). Nothing renders when there is no
 * message (and, on success, no fallback).
 */
export const CampaignFormActionMessage = ({
  state,
  errorTitle,
  successFallbackMessage,
  formFieldErrors,
}: {
  state: CampaignFormActionFeedbackState
  /** e.g. "Não foi possível enviar" — the destructive Alert's title. */
  errorTitle?: string
  /** Success text when the action returned none. */
  successFallbackMessage?: string
  /** Whole-form zod errors (`fieldErrors.form`), listed under the message. */
  formFieldErrors?: string[]
}) => {
  if (state.status === 'success') {
    const text = state.message ?? successFallbackMessage
    if (!text) return null
    return (
      <Alert aria-live="polite">
        <AlertDescription>{text}</AlertDescription>
      </Alert>
    )
  }

  if (!state.message && !formFieldErrors?.length) return null
  return (
    <Alert variant="destructive" aria-live="polite">
      {errorTitle ? <AlertTitle>{errorTitle}</AlertTitle> : null}
      <AlertDescription>
        {state.message ? <p>{state.message}</p> : null}
        {formFieldErrors?.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </AlertDescription>
    </Alert>
  )
}
