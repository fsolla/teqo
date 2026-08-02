import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { LeadershipForm } from '@/components/campaign/leadership/LeadershipForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
  loadStateDeputyOptions,
} from '@/utilities/campaignRelationOptions'

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
    loadMunicipalityOptions(payload, user),
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
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/liderancas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para lideranças
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova liderança</h1>
        <p className="text-muted-foreground">
          O contato é reaproveitado pelo celular quando já existe. Registre o consentimento antes de
          inserir dados reais.
        </p>
      </header>

      <LeadershipForm
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        stateDeputyOptions={stateDeputyOptions}
        initialMunicipalityIDs={initialMunicipalityIDs}
      />
    </CampaignPageShell>
  )
}
