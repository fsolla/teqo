import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { DemandForm } from '@/components/campaign/demand/DemandForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { loadActionPlanOptions, loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { createDemandFormAction } from './formActions'

type NewDemandPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewDemandPage({ searchParams }: NewDemandPageProps) {
  const [user, payload, query] = await Promise.all([
    getCampaignUser(),
    getPayload({ config }),
    searchParams,
  ])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const [municipalityOptions, actionPlanOptions] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadActionPlanOptions(payload, user),
  ])
  const requestedActionPlan = actionPlanOptions.find(
    (plan) => plan.id === strictDecimalInteger(firstValue(query.actionPlan)),
  )
  const requestedMunicipalityId = strictDecimalInteger(firstValue(query.municipality))
  const initialMunicipalityId =
    requestedActionPlan?.municipalityId ??
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
          Descreva a necessidade (material, transporte, espaço, apoio…) e a Praça. A assessoria
          revisa e responde por aqui.
        </p>
      </header>

      <DemandForm
        municipalityOptions={municipalityOptions}
        actionPlanOptions={actionPlanOptions}
        initialMunicipalityId={initialMunicipalityId}
        initialActionPlanId={requestedActionPlan?.id}
        formAction={createDemandFormAction}
      />
    </CampaignPageShell>
  )
}
