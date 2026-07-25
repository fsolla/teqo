'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { SupporterVoteIntentionFormState } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import { supporterVoteIntentionLabels } from '@/utilities/supporterUi'

export type VoteIntentionControlAction = (
  state: SupporterVoteIntentionFormState,
  formData: FormData,
) => Promise<SupporterVoteIntentionFormState>

export const VoteIntentionControl = ({
  supporterId,
  currentValue,
  hasVoteIntentionConsent,
  voteIntentionConsentConfigured,
  action,
}: {
  supporterId: number
  currentValue: SupporterVoteIntention | null
  hasVoteIntentionConsent: boolean
  voteIntentionConsentConfigured: boolean
  action: VoteIntentionControlAction
}) => {
  const [state, formAction, pending] = useActionState(action, {})
  const [localConsentAccepted, setLocalConsentAccepted] = useState(false)
  const [selected, setSelected] = useState<SupporterVoteIntention | ''>(currentValue ?? '')

  const canEdit =
    hasVoteIntentionConsent || (localConsentAccepted && voteIntentionConsentConfigured)

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    if (state.voteIntention) setSelected(state.voteIntention)
  }, [state.message, state.status, state.voteIntention])

  return (
    <section className="rounded-[6px] border bg-card p-4" aria-labelledby="vote-intention-title">
      <h2 id="vote-intention-title" className="font-medium">
        Intenção de voto
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dado sensível — disponível somente após confirmação do consentimento LGPD.
      </p>

      {!hasVoteIntentionConsent ? (
        voteIntentionConsentConfigured ? (
          <Field orientation="horizontal" className="mt-4">
            <Checkbox
              id="vote-intention-consent-accepted"
              checked={localConsentAccepted}
              onCheckedChange={(checked) => setLocalConsentAccepted(checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor="vote-intention-consent-accepted">
                Confirmo o consentimento destacado para registrar intenção de voto
              </FieldLabel>
              <FieldDescription>
                Marque somente se o titular autorizou expressamente este tratamento.
              </FieldDescription>
            </FieldContent>
          </Field>
        ) : (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Consentimento não configurado</AlertTitle>
            <AlertDescription>
              O texto de intenção de voto ainda não foi cadastrado no admin.
            </AlertDescription>
          </Alert>
        )
      ) : null}

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="id" value={supporterId} />
        <input type="hidden" name="voteIntention" value={selected} />
        {hasVoteIntentionConsent || localConsentAccepted ? (
          <input type="hidden" name="voteIntentionConsentAccepted" value="true" />
        ) : null}

        <ToggleGroup
          type="single"
          value={selected}
          onValueChange={(value) => setSelected((value as SupporterVoteIntention) ?? '')}
          variant="outline"
          className="flex w-full flex-wrap"
          disabled={!canEdit || pending}
        >
          {Object.entries(supporterVoteIntentionLabels).map(([value, label]) => (
            <ToggleGroupItem key={value} value={value} className="min-h-11 flex-1">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Disponível somente após confirmação do consentimento LGPD.
          </p>
        ) : null}

        {state.message && state.status !== 'success' ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          className="min-h-11 w-fit"
          disabled={!canEdit || !selected || pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Salvando…' : 'Salvar intenção'}
        </Button>
      </form>
    </section>
  )
}
