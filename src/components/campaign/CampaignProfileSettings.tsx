'use client'

import { useActionState } from 'react'

import { changeCampaignPasswordFormAction } from '@/app/(campaign)/campanha/actions/password'
import {
  removeCampaignAvatarFormAction,
  updateCampaignAvatarFormAction,
} from '@/app/(campaign)/campanha/actions/profile'
import { CampaignUserAvatar } from '@/components/campaign/CampaignUserAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import { campaignRoleLabels, type CampaignUserShellView } from '@/utilities/campaignUserProfile'
import { formatBrazilianPhoneDisplay } from '@/utilities/phone'

type CampaignProfileSettingsProps = {
  user: CampaignUserShellView & {
    email?: string | null
    username?: string | null
  }
  passwordResetBanner?: boolean
}

const FormActionStatus = ({ state }: { state: CampaignFormActionState }) => {
  if (!state.message) return null

  return (
    <p
      className={
        state.status === 'success' ? 'text-sm text-foreground' : 'text-sm text-destructive'
      }
      role="status"
    >
      {state.message}
    </p>
  )
}

export const CampaignProfileSettings = ({
  user,
  passwordResetBanner = false,
}: CampaignProfileSettingsProps) => {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changeCampaignPasswordFormAction,
    {} satisfies CampaignFormActionState,
  )
  const [avatarState, avatarAction, avatarPending] = useActionState(
    updateCampaignAvatarFormAction,
    {} satisfies CampaignFormActionState,
  )
  const [removeAvatarState, removeAvatarAction, removeAvatarPending] = useActionState(
    removeCampaignAvatarFormAction,
    {} satisfies CampaignFormActionState,
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie sua foto e senha de acesso à ferramenta de campanha.
        </p>
      </div>

      {passwordResetBanner ? (
        <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm" role="status">
          Senha redefinida com sucesso. Você já está autenticado.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
          <CardDescription>Dados da sua conta neste ciclo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <CampaignUserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Papel</dt>
              <dd>{campaignRoleLabels[user.role]}</dd>
            </div>
            {user.email ? (
              <div>
                <dt className="text-muted-foreground">E-mail</dt>
                <dd>{user.email}</dd>
              </div>
            ) : null}
            {user.username ? (
              <div>
                <dt className="text-muted-foreground">Celular de acesso</dt>
                <dd>{formatBrazilianPhoneDisplay(user.username)}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>JPEG, PNG ou WebP, até 2 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={avatarAction} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="avatar">Nova foto</FieldLabel>
              <Input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="min-h-11"
              />
            </Field>
            <FormActionStatus state={avatarState} />
            {fieldError(avatarState.fieldErrors, 'avatar') ? (
              <FieldError>{fieldError(avatarState.fieldErrors, 'avatar')}</FieldError>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="min-h-11" disabled={avatarPending}>
                {avatarPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span>{avatarPending ? 'Enviando...' : 'Atualizar foto'}</span>
              </Button>
            </div>
          </form>
          <FormActionStatus state={removeAvatarState} />
          {user.avatarUrl ? (
            <form action={removeAvatarAction} className="mt-2">
              <Button
                type="submit"
                variant="outline"
                className="min-h-11"
                disabled={removeAvatarPending}
              >
                Remover foto
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>
            {user.email
              ? 'Use sua senha atual para definir uma nova.'
              : 'Se você esqueceu a senha e acessa só com celular, peça um novo convite de acesso ao coordenador.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="currentPassword">Senha atual</FieldLabel>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="min-h-11"
                />
              </Field>
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
              <FormActionStatus state={passwordState} />
              {fieldError(passwordState.fieldErrors, 'currentPassword') ? (
                <FieldError>{fieldError(passwordState.fieldErrors, 'currentPassword')}</FieldError>
              ) : null}
              {fieldError(passwordState.fieldErrors, 'password') ? (
                <FieldError>{fieldError(passwordState.fieldErrors, 'password')}</FieldError>
              ) : null}
              {fieldError(passwordState.fieldErrors, 'passwordConfirmation') ? (
                <FieldError>
                  {fieldError(passwordState.fieldErrors, 'passwordConfirmation')}
                </FieldError>
              ) : null}
              <Button type="submit" className="min-h-11" disabled={passwordPending}>
                {passwordPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                <span>{passwordPending ? 'Salvando...' : 'Salvar nova senha'}</span>
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
