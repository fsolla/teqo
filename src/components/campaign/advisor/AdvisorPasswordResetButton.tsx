'use client'

import { KeyRoundIcon } from 'lucide-react'
import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { PLACEHOLDER_RESET_MESSAGE } from '@/lib/schemas/advisor'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type AdvisorPasswordResetButtonProps = {
  advisorId: number
  disabled: boolean
  /** `icon` is the compact row action; `block` is the labelled button plus hint. */
  layout?: 'block' | 'icon'
  /** Names the advisor for screen readers in the `icon` layout. */
  accessibleName?: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const AdvisorPasswordResetButton = ({
  advisorId,
  disabled,
  layout = 'block',
  accessibleName = 'Enviar link de senha',
  formAction,
}: AdvisorPasswordResetButtonProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  useCampaignFormSuccessToast({ status: state.status, message: state.message ?? 'Link enviado.' })

  useEffect(() => {
    if (state.message && state.status !== 'success') {
      toast.error(state.message)
    }
  }, [state.message, state.status])

  if (layout === 'icon') {
    return (
      <form action={submitAction}>
        <input type="hidden" name="advisorId" value={advisorId} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-10"
          disabled={disabled || isPending}
          aria-label={
            disabled ? `${accessibleName} — ${PLACEHOLDER_RESET_MESSAGE}` : accessibleName
          }
        >
          {isPending ? (
            <Spinner className="size-4" aria-hidden="true" />
          ) : (
            <KeyRoundIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    )
  }

  return (
    <form action={submitAction} className="flex flex-col gap-2">
      <input type="hidden" name="advisorId" value={advisorId} />
      <Button type="submit" className="min-h-11 w-fit" disabled={disabled || isPending}>
        {isPending ? <Spinner data-icon="inline-start" /> : null}
        Enviar link de senha
      </Button>
      {disabled ? (
        <p className="text-sm text-muted-foreground">{PLACEHOLDER_RESET_MESSAGE}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Envia um e-mail com link para o assessor definir a senha de acesso.
        </p>
      )}
    </form>
  )
}
