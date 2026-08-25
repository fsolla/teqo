'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useActionState, type FormEvent } from 'react'

import { registerActivityResultFormAction } from '@/app/(campaign)/campanha/(app)/atividades/[slug]/resultFormActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { fieldError } from '@/utilities/campaignFormFields'

type ActivityResultFormProps = {
  activityId: number
  initialSummary: string | null
  recordedByName: string | null
  recordedAt: string | null
}

export const ActivityResultForm = ({
  activityId,
  initialSummary,
  recordedByName,
  recordedAt,
}: ActivityResultFormProps) => {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(registerActivityResultFormAction, {})

  useCampaignFormSuccessToast(state, router.refresh)

  const summaryError = fieldError(state.fieldErrors, 'resultSummary')
  const recordedLabel = initialSummary
    ? [
        recordedByName ? `Registrado por ${recordedByName}` : 'Registrado',
        recordedAt ? `em ${formatBahiaDateTimeLabel(recordedAt)}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    : null

  // C139 — manual dispatch: React 19 resets uncontrolled fields after any
  // settled form action, reverting the typed result to `initialSummary` on
  // a validation error. `startTransition` keeps `pending` correct.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => formAction(new FormData(event.currentTarget)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado da atividade</CardTitle>
        {recordedLabel ? <p className="text-sm text-muted-foreground">{recordedLabel}</p> : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="activityId" value={activityId} />
          {state.status !== 'success' ? (
            <CampaignFormActionMessage state={state} errorTitle="Não foi possível registrar" />
          ) : null}
          <Field data-invalid={Boolean(summaryError)}>
            <FieldLabel htmlFor="result-summary">O que aconteceu *</FieldLabel>
            <Textarea
              id="result-summary"
              name="resultSummary"
              required
              maxLength={6000}
              defaultValue={initialSummary ?? ''}
              className="min-h-32"
              aria-invalid={Boolean(summaryError)}
              aria-describedby={summaryError ? 'result-summary-error' : undefined}
            />
            <FieldDescription>
              Público, aprendizados e próximos passos. Fotos e vídeos podem ser anexados em breve —
              registre links no texto por enquanto.
            </FieldDescription>
            {summaryError ? (
              <FieldError id="result-summary-error">{summaryError}</FieldError>
            ) : null}
          </Field>
          <Button type="submit" className="min-h-11 w-fit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? 'Salvando…' : initialSummary ? 'Atualizar resultado' : 'Registrar resultado'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
