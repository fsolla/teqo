'use client'

import { useActionState, useEffect, useState } from 'react'

import { searchDemandResponsibleOptions } from '@/app/(campaign)/campanha/(app)/demandas/responsibleSearchActions'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { CAMPAIGN_DEMAND_RESPONSIBLES_LABEL } from '@/lib/schemas/campaignDemand'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  DemandResponsibleMultiSelect,
  type DemandResponsibleOption,
} from './DemandResponsibleMultiSelect'

type DemandResponsiblesCardProps = {
  demandId: number
  municipalityId: number | null
  /** The creator id, shown as "(criador)" on the chip (removal stays allowed — hand-off). */
  creatorUserId: number | null
  initialResponsibles: DemandResponsibleOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): the responsibles render as chips with no editor. */
  readOnly?: boolean
}

/**
 * C143 — responsible management on the demand detail. Everyone who can read
 * the demand can update it (same row scope), so the card's edit controls are
 * available to whoever opens the page; the save submits the full list, the
 * action revalidates the page and the local state keeps the saved chips
 * (the success message is the confirmation, so no remount key is used).
 */
export const DemandResponsiblesCard = ({
  demandId,
  municipalityId,
  creatorUserId,
  initialResponsibles,
  formAction,
  readOnly = false,
}: DemandResponsiblesCardProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (state.status === 'success') setDirty(false)
  }, [state.status])

  const search = (query: string) => searchDemandResponsibleOptions(query, municipalityId)

  if (readOnly) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">{CAMPAIGN_DEMAND_RESPONSIBLES_LABEL}</h2>
          <p className="text-sm text-muted-foreground">Só quem é responsável vê esta demanda.</p>
        </div>
        {initialResponsibles.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {initialResponsibles.map((responsible) => (
              <li key={responsible.id} className="text-sm">
                {responsible.name}
                {responsible.id === creatorUserId ? ' (criador)' : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sem responsáveis.</p>
        )}
      </section>
    )
  }

  return (
    <form action={submitAction} className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{CAMPAIGN_DEMAND_RESPONSIBLES_LABEL}</h2>
        <p className="text-sm text-muted-foreground">Só quem é responsável vê esta demanda.</p>
      </div>

      <DemandResponsibleMultiSelect
        name="responsibles"
        value={initialResponsibles}
        creatorUserId={creatorUserId}
        lockCreator={false}
        search={search}
        triggerPlaceholder="Adicionar responsável…"
        triggerAriaLabel={CAMPAIGN_DEMAND_RESPONSIBLES_LABEL}
        disabled={isPending}
        onChange={() => setDirty(true)}
      />

      <p className="text-xs text-muted-foreground">
        O criador já entra como responsável automaticamente. Assessores do município aparecem como
        sugestão, mas só quem for marcado enxerga.
      </p>

      <CampaignFormActionMessage state={state} />

      <Button
        type="submit"
        variant="outline"
        className="min-h-9 self-start"
        disabled={isPending || !dirty}
      >
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar responsáveis
      </Button>

      <input type="hidden" name="demandId" value={demandId} />
    </form>
  )
}
