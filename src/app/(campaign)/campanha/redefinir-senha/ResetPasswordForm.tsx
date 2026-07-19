'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { resetCampaignPasswordFormAction } from '@/app/(campaign)/campanha/actions/password'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha com pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
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
            {fieldError(state.fieldErrors, 'password') ? (
              <FieldError>{fieldError(state.fieldErrors, 'password')}</FieldError>
            ) : null}
            {fieldError(state.fieldErrors, 'passwordConfirmation') ? (
              <FieldError>{fieldError(state.fieldErrors, 'passwordConfirmation')}</FieldError>
            ) : null}
            <Button type="submit" className="min-h-11 w-full" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              <span aria-live="polite">{pending ? 'Salvando...' : 'Salvar nova senha'}</span>
            </Button>
            <p className="text-center text-sm">
              <Link href="/campanha/login" className="text-primary underline-offset-4 hover:underline">
                Voltar ao login
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
