'use client'

import { useActionState } from 'react'

import { requestCampaignPasswordResetFormAction } from '@/app/(campaign)/campanha/actions/password'
import { CampaignAuthBackToLoginLink } from '@/components/campaign/auth/CampaignAuthBackToLoginLink'
import { CampaignAuthCardHeader } from '@/components/campaign/auth/CampaignAuthCardHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT,
  campaignAuthMutedTextClassName,
} from '@/lib/campaignAuthCopy'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

export const ForgotPasswordForm = () => {
  const [state, formAction, pending] = useActionState(
    requestCampaignPasswordResetFormAction,
    {} satisfies CampaignFormActionState,
  )
  const emailError = fieldError(state.fieldErrors, 'email')

  return (
    <Card>
      <CampaignAuthCardHeader
        title="Esqueceu a senha?"
        description={
          <>Informe o e-mail cadastrado na sua conta. {CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT}</>
        }
      />
      <CardContent>
        {state.status === 'success' && state.message ? (
          <div className={campaignAuthMutedTextClassName} role="status">
            {state.message}
          </div>
        ) : (
          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="min-h-11"
                />
              </Field>
              {state.message ? <FieldError>{state.message}</FieldError> : null}
              {emailError ? <FieldError>{emailError}</FieldError> : null}
              <Button type="submit" className="min-h-11 w-full" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span aria-live="polite">{pending ? 'Enviando...' : 'Enviar link'}</span>
              </Button>
              <CampaignAuthBackToLoginLink />
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
