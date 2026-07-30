'use client'

import { CheckCircle2Icon, ShieldCheckIcon } from 'lucide-react'
import { type ReactNode, useActionState } from 'react'

import type {
  BoundCampaignInviteFormAction,
  CampaignInviteFormState,
} from '@/app/(campaign)/campanha/convite/[token]/formActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { errorProps, fieldError } from '@/utilities/campaignFormFields'
import { leadershipGenderLabels } from '@/utilities/leadership/leadershipUi'

type CampaignInviteProfile = {
  name: string
  phone: string
  email: string | null
  gender: keyof typeof leadershipGenderLabels | null
}

const genderOptions = Object.entries(leadershipGenderLabels) as Array<
  [NonNullable<CampaignInviteProfile['gender']>, string]
>

const CampaignInviteFeedback = ({ state }: { state: CampaignInviteFormState }) => {
  if (state.status === 'success') return null
  return <CampaignFormActionMessage state={state} errorTitle="Não foi possível confirmar" />
}

const ConsentField = ({ children, error }: { children: ReactNode; error?: string }) => (
  <section id="texto-consentimento" className="flex flex-col gap-3" aria-labelledby="consent-title">
    <div>
      <h2 id="consent-title" className="font-medium">
        Consentimento para uso dos dados
      </h2>
      <p className="text-sm text-muted-foreground">
        Leia o texto e confirme somente se estiver de acordo.{' '}
        <a className="underline underline-offset-4" href="#campaign-invite-consent-full">
          Ler o texto completo
        </a>
      </p>
    </div>
    <div
      id="campaign-invite-consent-full"
      className="max-h-56 overflow-y-auto rounded-lg border p-3 text-sm"
      tabIndex={-1}
    >
      {children}
    </div>
    <Field orientation="horizontal" data-invalid={Boolean(error)}>
      <Checkbox
        id="campaign-invite-consent"
        name="consentAccepted"
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'campaign-invite-consent-error' : 'campaign-invite-consent-help'}
      />
      <FieldContent>
        <FieldLabel htmlFor="campaign-invite-consent">
          Li e concordo com o texto de consentimento *
        </FieldLabel>
        <FieldDescription id="campaign-invite-consent-help">
          Você confirma os próprios dados enviados neste formulário.
        </FieldDescription>
        {error ? <FieldError id="campaign-invite-consent-error">{error}</FieldError> : null}
      </FieldContent>
    </Field>
  </section>
)

const ProfileFields = ({
  preview,
  state,
}: {
  preview: { profile: CampaignInviteProfile }
  state: CampaignInviteFormState
}) => {
  const { profile } = preview
  const inviteField = (field: string) => errorProps(state.fieldErrors, field, 'campaign-invite')
  const name = inviteField('name')
  const phone = inviteField('phone')
  const email = inviteField('email')
  const gender = inviteField('gender')

  return (
    <FieldGroup>
      <Field data-invalid={name.invalid}>
        <FieldLabel htmlFor="campaign-invite-name">Nome *</FieldLabel>
        <Input
          id="campaign-invite-name"
          name="name"
          defaultValue={profile.name}
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={name.invalid}
          aria-describedby={name.describedBy}
        />
        {name.error ? <FieldError id={name.describedBy}>{name.error}</FieldError> : null}
      </Field>

      <Field data-invalid={phone.invalid}>
        <FieldLabel htmlFor="campaign-invite-phone">Celular (WhatsApp) *</FieldLabel>
        <Input
          id="campaign-invite-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={profile.phone}
          autoComplete="tel"
          required
          aria-invalid={phone.invalid}
          aria-describedby={phone.describedBy}
        />
        {phone.error ? <FieldError id={phone.describedBy}>{phone.error}</FieldError> : null}
      </Field>

      <Field data-invalid={email.invalid}>
        <FieldLabel htmlFor="campaign-invite-email">E-mail (opcional)</FieldLabel>
        <Input
          id="campaign-invite-email"
          name="email"
          type="email"
          defaultValue={profile.email ?? ''}
          autoComplete="email"
          aria-invalid={email.invalid}
          aria-describedby={email.describedBy}
        />
        {email.error ? <FieldError id={email.describedBy}>{email.error}</FieldError> : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={gender.invalid}>
          <FieldLabel htmlFor="campaign-invite-gender">Gênero</FieldLabel>
          <NativeSelect
            id="campaign-invite-gender"
            name="gender"
            className="w-full"
            defaultValue={profile.gender ?? ''}
            aria-invalid={gender.invalid}
            aria-describedby={gender.describedBy}
          >
            <NativeSelectOption value="">Não informar</NativeSelectOption>
            {genderOptions.map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {gender.error ? <FieldError id={gender.describedBy}>{gender.error}</FieldError> : null}
        </Field>
      </div>
    </FieldGroup>
  )
}

export const CampaignInviteForm = ({
  action,
  children,
  kind,
  profile,
  requiresConsent,
}: {
  action: BoundCampaignInviteFormAction
  children?: ReactNode
  kind: 'autopreenchimento' | 'login'
  profile: CampaignInviteProfile
  requiresConsent: boolean
}) => {
  const [state, formAction, pending] = useActionState(action, {})
  const consentError = fieldError(state.fieldErrors, 'consentAccepted')
  const passwordError = fieldError(state.fieldErrors, 'password')
  const confirmationError = fieldError(state.fieldErrors, 'passwordConfirmation')

  if (state.status === 'success') {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CheckCircle2Icon aria-hidden="true" />
          <CardTitle>Dados confirmados</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Você já pode fechar esta página.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheckIcon aria-hidden="true" />
          <span className="text-sm font-medium">Campanha do Solla</span>
        </div>
        <CardTitle>Oi, {profile.name}!</CardTitle>
        <CardDescription>
          {kind === 'login'
            ? 'Revise seus dados e defina uma senha para acessar a plataforma da campanha.'
            : 'Revise e confirme seus dados para a campanha do Jorge Solla.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5" aria-busy={pending}>
          <CampaignInviteFeedback state={state} />
          <ProfileFields preview={{ profile }} state={state} />

          {requiresConsent ? (
            <ConsentField error={consentError}>{children}</ConsentField>
          ) : (
            <Alert>
              <CheckCircle2Icon aria-hidden="true" />
              <AlertTitle>Consentimento já confirmado</AlertTitle>
              <AlertDescription>
                Você pode revisar seus dados e continuar sem aceitar novamente.
              </AlertDescription>
            </Alert>
          )}

          {kind === 'login' ? (
            <FieldGroup>
              <Field data-invalid={Boolean(passwordError)}>
                <FieldLabel htmlFor="campaign-invite-password">Nova senha *</FieldLabel>
                <Input
                  id="campaign-invite-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={
                    passwordError
                      ? 'campaign-invite-password-error'
                      : 'campaign-invite-password-help'
                  }
                />
                <FieldDescription id="campaign-invite-password-help">
                  Use pelo menos 8 caracteres.
                </FieldDescription>
                {passwordError ? (
                  <FieldError id="campaign-invite-password-error">{passwordError}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={Boolean(confirmationError)}>
                <FieldLabel htmlFor="campaign-invite-password-confirmation">
                  Confirme a nova senha *
                </FieldLabel>
                <Input
                  id="campaign-invite-password-confirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  aria-invalid={Boolean(confirmationError)}
                  aria-describedby={
                    confirmationError ? 'campaign-invite-password-confirmation-error' : undefined
                  }
                />
                {confirmationError ? (
                  <FieldError id="campaign-invite-password-confirmation-error">
                    {confirmationError}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          ) : null}

          <Button type="submit" className="min-h-11 w-full" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? 'Confirmando…'
              : kind === 'login'
                ? 'Criar ou recuperar meu acesso'
                : 'Confirmar meus dados'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Esta página não usa rastreadores externos.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
