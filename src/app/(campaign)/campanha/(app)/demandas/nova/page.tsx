import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { searchDemandActivityOptions } from '@/app/(campaign)/campanha/(app)/demandas/activitySearchActions'
import { DemandForm } from '@/components/campaign/demand/DemandForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { Button } from '@/components/ui/button'
import { loadActivityRelationOptionById } from '@/utilities/activityRelationOptions'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { createDemandFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('demandasNova')

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
      <Button asChild variant="ghost" className="min-h-11 self-start">
        <Link href="/campanha/demandas">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Voltar para demandas
        </Link>
      </Button>

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
