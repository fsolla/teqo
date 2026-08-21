'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  CAMPAIGN_DEMAND_BODY_LABEL,
  CAMPAIGN_DEMAND_BODY_MAX_LENGTH,
} from '@/lib/schemas/campaignDemand'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type DemandDescriptionEditorProps = {
  demandId: number
  initialDescription: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): the description renders with no edit affordance. */
  readOnly?: boolean
}

/**
 * Inline edit of the single demand free-text field (B195): saving re-derives
 * the AI title server-side (previous title kept on AI failure) and the
 * canonical slug never changes — the page refreshes to the new title.
 */
export const DemandDescriptionEditor = ({
  demandId,
  initialDescription,
  formAction,
  readOnly = false,
}: DemandDescriptionEditorProps) => {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [state, submitAction, isPending] = useActionState(formAction, {})

  useCampaignFormSuccessToast(state, () => {
    setEditing(false)
    router.refresh()
  })

  if (!editing) {
    return (
      <section aria-label="Descrição da demanda" className="rounded-xl border p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap text-sm">{initialDescription}</p>
          {readOnly ? null : (
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              {initialDescription ? 'Editar' : 'Adicionar descrição'}
            </Button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Editar descrição da demanda" className="rounded-xl border p-4">
      <form
        action={submitAction}
        className="flex flex-col gap-4"
        aria-busy={isPending || undefined}
        data-pending={isPending ? '' : undefined}
      >
        <input type="hidden" name="demandId" value={demandId} />
        <Field>
          <FieldLabel htmlFor="demand-description-edit">{CAMPAIGN_DEMAND_BODY_LABEL}</FieldLabel>
          <Textarea
            id="demand-description-edit"
            name="description"
            defaultValue={initialDescription}
            rows={5}
            minLength={2}
            maxLength={CAMPAIGN_DEMAND_BODY_MAX_LENGTH}
            required
            disabled={isPending}
            className="min-h-28"
          />
          {state.fieldErrors?.description ? (
            <FieldError>{state.fieldErrors.description}</FieldError>
          ) : null}
        </Field>
        {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="min-h-11">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
        <div aria-live="polite" className="sr-only">
          {isPending ? 'Salvando descrição.' : null}
        </div>
      </form>
    </section>
  )
}
