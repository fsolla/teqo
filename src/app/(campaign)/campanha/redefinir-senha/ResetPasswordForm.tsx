'use client'

import { useActionState } from 'react'

import { resetCampaignPasswordFormAction } from '@/app/(campaign)/campanha/actions/password'
import { CampaignAuthBackToLoginLink } from '@/components/campaign/auth/CampaignAuthBackToLoginLink'
import { CampaignAuthCardHeader } from '@/components/campaign/auth/CampaignAuthCardHeader'
import { CampaignPasswordFields } from '@/components/campaign/auth/CampaignPasswordFields'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

export const ResetPasswordForm = ({ token }: { token: string }) => {
  const [state, formAction, pending] = useActionState(
    resetCampaignPasswordFormAction.bind(null, token),
    {} satisfies CampaignFormActionState,
  )

  return (
    <Card>
      <CampaignAuthCardHeader
        title="Redefinir senha"
        description="Escolha uma nova senha com pelo menos 8 caracteres."
      />
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <CampaignPasswordFields fieldErrors={state.fieldErrors} idPrefix="reset-password" />
            {state.message ? <FieldError>{state.message}</FieldError> : null}
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
