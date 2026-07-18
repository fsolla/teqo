'use client'

import { useActionState } from 'react'

import { loginCampaignFormAction } from '@/app/(campaign)/campanha/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'

export const LoginForm = () => {
  const [state, formAction, pending] = useActionState(loginCampaignFormAction, {})

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Acessar painel</CardTitle>
        <CardDescription>Entre com seu e-mail ou celular para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="identifier">E-mail ou celular</FieldLabel>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                enterKeyHint="next"
                placeholder="voce@exemplo.com ou (71) 99999-1234"
                required
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="current-password">Senha</FieldLabel>
              <Input
                id="current-password"
                name="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="done"
                required
                className="min-h-11"
              />
            </Field>
            <Field>
              {state.error ? <FieldError>{state.error}</FieldError> : null}
              <Button type="submit" className="min-h-11" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span aria-live="polite">{pending ? 'Entrando...' : 'Entrar'}</span>
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
