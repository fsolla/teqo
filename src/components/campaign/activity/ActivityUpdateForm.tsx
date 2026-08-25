'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useActionState, useRef, type FormEvent } from 'react'

import { createActivityUpdateFormAction } from '@/app/(campaign)/campanha/(app)/atividades/[slug]/updateFormActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/utilities/campaignFormFields'

export const ActivityUpdateForm = ({ activityId }: { activityId: number }) => {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(createActivityUpdateFormAction, {})

  useCampaignFormSuccessToast(state, () => {
    formRef.current?.reset()
    router.refresh()
  })

  const bodyError = fieldError(state.fieldErrors, 'body')

  // C139 — manual dispatch (no `action={formAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping the typed
  // update on a validation error. `startTransition` keeps `pending` correct.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => formAction(new FormData(event.currentTarget)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova atualização</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="activityId" value={activityId} />
          {state.status !== 'success' ? (
            <CampaignFormActionMessage state={state} errorTitle="Não foi possível enviar" />
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
