'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { registerActionPlanResultFormAction } from '@/app/(campaign)/campanha/(app)/planos/[slug]/resultFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/utilities/campaignFormFields'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'

type ActionPlanResultFormProps = {
  planId: number
  initialSummary: string | null
  recordedByName: string | null
  recordedAt: string | null
}

export const ActionPlanResultForm = ({
  planId,
  initialSummary,
  recordedByName,
  recordedAt,
}: ActionPlanResultFormProps) => {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(registerActionPlanResultFormAction, {})

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    router.refresh()
  }, [router, state.message, state.status])

  const summaryError = fieldError(state.fieldErrors, 'resultSummary')
  const recordedLabel = initialSummary
    ? [
        recordedByName ? `Registrado por ${recordedByName}` : 'Registrado',
        recordedAt ? `em ${formatBahiaDateTimeLabel(recordedAt)}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado da ação</CardTitle>
        {recordedLabel ? <p className="text-sm text-muted-foreground">{recordedLabel}</p> : null}
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="planId" value={planId} />
          {state.message && state.status !== 'success' ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertTitle>Não foi possível registrar</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
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
