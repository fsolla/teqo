'use client'

import { useActionState } from 'react'

import { resetCampaignPasswordFormAction } from '@/app/(campaign)/campanha/actions/password'
import { CampaignAuthBackToLoginLink } from '@/components/campaign/CampaignAuthBackToLoginLink'
import { CampaignAuthCardHeader } from '@/components/campaign/CampaignAuthCardHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

export const ResetPasswordForm = ({ token }: { token: string }) => {
  const [state, formAction, pending] = useActionState(
    resetCampaignPasswordFormAction.bind(null, token),
    {} satisfies CampaignFormActionState,
  )
  const passwordError = fieldError(state.fieldErrors, 'password')
  const passwordConfirmationError = fieldError(state.fieldErrors, 'passwordConfirmation')

  return (
    <Card>
      <CampaignAuthCardHeader
        title="Redefinir senha"
        description="Escolha uma nova senha com pelo menos 8 caracteres."
      />
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">Nova senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="passwordConfirmation">Confirmar nova senha</FieldLabel>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="min-h-11"
              />
            </Field>
            {state.message ? <FieldError>{state.message}</FieldError> : null}
            {passwordError ? <FieldError>{passwordError}</FieldError> : null}
            {passwordConfirmationError ? (
              <FieldError>{passwordConfirmationError}</FieldError>
            ) : null}
            <Button type="submit" className="min-h-11 w-full" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              <span aria-live="polite">{pending ? 'Salvando...' : 'Salvar nova senha'}</span>
            </Button>
            <CampaignAuthBackToLoginLink />
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
