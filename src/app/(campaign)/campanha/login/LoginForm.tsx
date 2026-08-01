'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { loginCampaignFormAction } from '@/app/(campaign)/campanha/actions/auth'
import { CampaignAuthCardHeader } from '@/components/campaign/auth/CampaignAuthCardHeader'
import { CampaignBiometricLoginButton } from '@/components/campaign/auth/CampaignBiometricLoginButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  CAMPAIGN_FIRST_ACCESS_HINT,
  CAMPAIGN_LEADERSHIP_LOGIN_RECOVERY_HINT,
  CAMPAIGN_LOGIN_SUBTITLE,
  CAMPAIGN_REMEMBER_ME_DESCRIPTION,
  campaignAuthMutedTextClassName,
  campaignAuthTextLinkClassName,
} from '@/lib/campaignAuthCopy'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { firstFormActionMessage } from '@/utilities/campaignFormFields'

const LOGIN_ERROR_ID = 'login-credentials-error'

const identifierInputMode = (value: string): 'tel' | 'email' | 'text' => {
  const trimmed = value.trim()
  if (!trimmed) return 'text'
  if (trimmed.includes('@')) return 'email'
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 2 && !/[a-zA-Z]/.test(trimmed)) return 'tel'
  return 'text'
}

type LoginFormProps = {
  /** False when the origin cannot host a WebAuthn ceremony (Vercel previews). */
  biometricsConfigured: boolean
}

export const LoginForm = ({ biometricsConfigured }: LoginFormProps) => {
  const [state, formAction, pending] = useActionState(
    loginCampaignFormAction,
    {} satisfies CampaignFormActionState,
  )
  const [identifier, setIdentifier] = useState('')
  const authError = firstFormActionMessage(state)
  const hasAuthError = Boolean(authError)

  return (
    <Card>
      <CampaignAuthCardHeader title="Entrar na campanha" description={CAMPAIGN_LOGIN_SUBTITLE} />
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field data-invalid={hasAuthError || undefined}>
              <FieldLabel htmlFor="identifier">E-mail ou celular</FieldLabel>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                inputMode={identifierInputMode(identifier)}
                autoComplete="username"
                enterKeyHint="next"
                placeholder="(71) 99999-1234 ou voce@exemplo.com"
                required
                className="min-h-11"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                aria-invalid={hasAuthError || undefined}
                aria-describedby={hasAuthError ? LOGIN_ERROR_ID : undefined}
              />
            </Field>
            <Field data-invalid={hasAuthError || undefined}>
              <FieldLabel htmlFor="current-password">Senha</FieldLabel>
              <Input
                id="current-password"
                name="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="done"
                required
                className="min-h-11"
                aria-invalid={hasAuthError || undefined}
                aria-describedby={hasAuthError ? LOGIN_ERROR_ID : undefined}
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="remember-me"
                name="rememberMe"
                value="true"
                aria-describedby="remember-me-description"
                className="after:-inset-x-3.5 after:-inset-y-3.5"
              />
              <FieldContent>
                <FieldLabel htmlFor="remember-me">Lembrar de mim neste dispositivo</FieldLabel>
                <FieldDescription id="remember-me-description">
                  {CAMPAIGN_REMEMBER_ME_DESCRIPTION}
                </FieldDescription>
              </FieldContent>
            </Field>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/campanha/esqueci-senha" className={campaignAuthTextLinkClassName}>
                Esqueceu a senha?
              </Link>
              {hasAuthError ? (
                <div className={campaignAuthMutedTextClassName}>
                  {CAMPAIGN_LEADERSHIP_LOGIN_RECOVERY_HINT}
                </div>
              ) : null}
            </div>
            <Field>
              {authError ? <FieldError id={LOGIN_ERROR_ID}>{authError}</FieldError> : null}
              <Button type="submit" className="min-h-11 w-full" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span aria-live="polite">{pending ? 'Entrando...' : 'Entrar'}</span>
              </Button>
            </Field>
            <details className="text-center text-sm">
              <summary
                className={cn(
                  'cursor-pointer underline-offset-4 marker:content-none hover:underline [&::-webkit-details-marker]:hidden',
                  'text-muted-foreground hover:text-foreground',
                )}
              >
                Primeiro acesso?
              </summary>
              <div className={cn(campaignAuthMutedTextClassName, 'mt-2')}>
                {CAMPAIGN_FIRST_ACCESS_HINT}
              </div>
            </details>
          </FieldGroup>
        </form>
        {/* Outside the form: this is a second, independent way in, and nesting
            it would make it look like a submit path of the password fields. */}
        {biometricsConfigured ? <CampaignBiometricLoginButton /> : null}
      </CardContent>
    </Card>
  )
}
