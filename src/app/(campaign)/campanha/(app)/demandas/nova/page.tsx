import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { searchDemandActivityOptions } from '@/app/(campaign)/campanha/(app)/demandas/activitySearchActions'
import { DemandForm } from '@/components/campaign/demand/DemandForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { loadActivityRelationOptionById } from '@/utilities/activityRelationOptions'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { createDemandFormAction } from './formActions'

type NewDemandPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewDemandPage({ searchParams }: NewDemandPageProps) {
  const [user, payload, query] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
    searchParams,
  ])

  const requestedActivityId = strictDecimalInteger(firstValue(query.activity))
  const requestedMunicipalityId = strictDecimalInteger(firstValue(query.municipality))
  const [municipalityOptions, initialActivity] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    requestedActivityId
      ? loadActivityRelationOptionById(payload, user, requestedActivityId)
      : Promise.resolve(null),
  ])
  const initialMunicipalityId =
    initialActivity?.municipalityId ??
    municipalityOptions.find((option) => option.id === requestedMunicipalityId)?.id

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/demandas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para demandas
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova demanda</h1>
        <p className="text-muted-foreground">
          Descreva a necessidade (material, transporte, espaço, apoio…) e o município. A assessoria
          revisa e responde por aqui.
        </p>
      </header>

      <DemandForm
        municipalityOptions={municipalityOptions}
        initialActivity={initialActivity}
        initialMunicipalityId={initialMunicipalityId}
        searchActivities={searchDemandActivityOptions}
        formAction={createDemandFormAction}
      />
    </CampaignPageShell>
  )
}
