'use client'

import { useActionState, useCallback, useState } from 'react'

import { searchDemandResponsibleOptions } from '@/app/(campaign)/campanha/(app)/demandas/responsibleSearchActions'
import { DemandFields, type DemandActivityValue } from '@/components/campaign/demand/DemandFields'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { CAMPAIGN_DEMAND_SUBMIT_LABEL } from '@/lib/schemas/campaignDemand'
import type { ActivityRelationOption } from '@/utilities/activityRelationOptions'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type DemandFormProps = {
  municipalityOptions: RelationOption[]
  initialActivity?: ActivityRelationOption | null
  initialMunicipalityId?: number
  currentUser?: { id: number; name: string } | null
  searchActivities: (
    query: string,
    municipalityId: number | null,
  ) => Promise<Array<{ id: number; label: string }>>
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const DemandForm = ({
  municipalityOptions,
  initialActivity = null,
  initialMunicipalityId,
  currentUser = null,
  searchActivities,
  formAction,
}: DemandFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [municipalityId, setMunicipalityId] = useState(
    initialMunicipalityId ? String(initialMunicipalityId) : '',
  )
  const [activity, setActivity] = useState<DemandActivityValue | null>(
    initialActivity ? { id: initialActivity.id, label: initialActivity.label } : null,
  )

  const parsedMunicipalityId = municipalityId ? Number(municipalityId) : null
  const searchActivitiesForMunicipality = useCallback(
    (query: string) => searchActivities(query, parsedMunicipalityId),
    [parsedMunicipalityId, searchActivities],
  )
  const searchResponsibles = useCallback(
    (query: string) => searchDemandResponsibleOptions(query, parsedMunicipalityId),
    [parsedMunicipalityId],
  )

  return (
    <form action={submitAction} className="flex max-w-3xl flex-col gap-4">
      <DemandFields
        idPrefix="demand"
        state={state}
        activity={activity}
        onActivityChange={setActivity}
        searchActivities={searchActivitiesForMunicipality}
        municipality={{
          options: municipalityOptions,
          value: municipalityId,
          onValueChange: setMunicipalityId,
        }}
        responsibles={{
          currentUser,
          search: searchResponsibles,
          layout: 'aside',
        }}
      />
      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        {CAMPAIGN_DEMAND_SUBMIT_LABEL}
      </Button>
    </form>
  )
}
