'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StarIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  setPrimaryContactFormAction,
  type LeadershipFormState,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { fieldError } from '@/utilities/campaignFormFields'

export const PrimaryContactFormFields = ({
  nucleusId,
  contactId,
  state,
}: {
  nucleusId: number
  contactId: number
  state: LeadershipFormState
}) => {
  const nucleusError = fieldError(state.fieldErrors, 'nucleus')
  const contactError = fieldError(state.fieldErrors, 'contact')
  const hasError = Boolean(state.message || nucleusError || contactError)

  return (
    <>
      <input
        type="hidden"
        name="nucleus"
        value={nucleusId}
        aria-invalid={Boolean(nucleusError)}
        aria-describedby={nucleusError ? 'primary-contact-nucleus-error' : undefined}
      />
      <input
        type="hidden"
        name="contact"
        value={contactId}
        aria-invalid={Boolean(contactError)}
        aria-describedby={contactError ? 'primary-contact-contact-error' : undefined}
      />
      {hasError ? (
        <Alert
          id="primary-contact-form-error"
          variant="destructive"
          aria-live="polite"
          className="mb-2"
        >
          <AlertTitle>Não foi possível atualizar</AlertTitle>
          <AlertDescription>
            {state.message ? <p>{state.message}</p> : null}
            {nucleusError ? <p id="primary-contact-nucleus-error">{nucleusError}</p> : null}
            {contactError ? <p id="primary-contact-contact-error">{contactError}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}

export const LeadershipPrimaryContactAction = ({
  contactId,
  nucleusId,
}: {
  contactId: number
  nucleusId: number
}) => {
  const router = useRouter()
  const [state, action, pending] = useActionState<LeadershipFormState, FormData>(
    setPrimaryContactFormAction,
    {},
  )

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    router.refresh()
  }, [router, state.message, state.status])

  return (
    <form
      action={action}
      aria-describedby={hasError ? 'primary-contact-form-error' : undefined}
    >
      <PrimaryContactFormFields
        nucleusId={nucleusId}
        contactId={contactId}
        state={state.status === 'success' ? {} : state}
      />
      <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <StarIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {pending ? 'Atualizando…' : 'Definir como contato principal'}
      </Button>
    </form>
  )
}
