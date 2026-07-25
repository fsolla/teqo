'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { createActionPlanUpdateFormAction } from '@/app/(campaign)/campanha/(app)/planos/[slug]/updateFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/utilities/campaignFormFields'

export const ActionPlanUpdateForm = ({ planId }: { planId: number }) => {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(createActionPlanUpdateFormAction, {})

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    formRef.current?.reset()
    router.refresh()
  }, [router, state.message, state.status])

  const bodyError = fieldError(state.fieldErrors, 'body')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova atualização</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="planId" value={planId} />
          {state.message && state.status !== 'success' ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertTitle>Não foi possível enviar</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={Boolean(bodyError)}>
            <FieldLabel htmlFor="update-body">Texto da atualização *</FieldLabel>
            <Textarea
              id="update-body"
              name="body"
              required
              maxLength={4000}
              className="min-h-24"
              aria-invalid={Boolean(bodyError)}
              aria-describedby={bodyError ? 'update-body-error' : undefined}
            />
            {bodyError ? <FieldError id="update-body-error">{bodyError}</FieldError> : null}
          </Field>
          <Button type="submit" className="min-h-11 w-fit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? 'Enviando…' : 'Enviar atualização'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
