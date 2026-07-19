'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { requestCampaignPasswordResetFormAction } from '@/app/(campaign)/campanha/actions/password'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT,
  campaignAuthHeadingClassName,
} from '@/lib/campaignAuthCopy'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

export const ForgotPasswordForm = () => {
  const [state, formAction, pending] = useActionState(
    requestCampaignPasswordResetFormAction,
    {} satisfies CampaignFormActionState,
  )

  return (
    <Card>
      <CardHeader className="text-center">
        <h1 className={campaignAuthHeadingClassName}>Esqueceu a senha?</h1>
        <CardDescription>
          Informe o e-mail cadastrado na sua conta. {CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === 'success' && state.message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {state.message}
          </p>
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
              {fieldError(state.fieldErrors, 'email') ? (
                <FieldError>{fieldError(state.fieldErrors, 'email')}</FieldError>
              ) : null}
              <Button type="submit" className="min-h-11 w-full" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span aria-live="polite">{pending ? 'Enviando...' : 'Enviar link'}</span>
              </Button>
              <p className="text-center text-sm">
                <Link
                  href="/campanha/login"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Voltar ao login
                </Link>
              </p>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
