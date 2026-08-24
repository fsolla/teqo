import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { LeadershipForm } from '@/components/campaign/leadership/LeadershipForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadOrganizationOptions,
  loadStateDeputyOptions,
  loadWritableMunicipalityOptions,
} from '@/utilities/campaignRelationOptions'
import { createLeadershipFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('liderancasNova')

type NewLeadershipPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewLeadershipPage({ searchParams }: NewLeadershipPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const [municipalityOptions, organizationOptions, stateDeputyOptions] = await Promise.all([
    loadWritableMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    loadStateDeputyOptions(payload, user),
  ])

  const rawInitialMunicipality = Array.isArray(rawSearchParams.municipality)
    ? rawSearchParams.municipality[0]
    : rawSearchParams.municipality
  const initialMunicipalityID =
    rawInitialMunicipality && /^[1-9]\d*$/.test(rawInitialMunicipality)
      ? Number(rawInitialMunicipality)
      : null
  const initialMunicipalityIDs =
    initialMunicipalityID &&
    municipalityOptions.some((option) => option.id === initialMunicipalityID)
      ? [initialMunicipalityID]
      : []

  return (
    <CampaignPageShell>
      <Button asChild variant="ghost" className="min-h-11 self-start">
        <Link href="/campanha/liderancas">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Voltar para lideranças
        </Link>
      </Button>

      <LeadershipForm
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        stateDeputyOptions={stateDeputyOptions}
        initialMunicipalityIDs={initialMunicipalityIDs}
        formAction={createLeadershipFormAction}
      />
    </CampaignPageShell>
  )
}
