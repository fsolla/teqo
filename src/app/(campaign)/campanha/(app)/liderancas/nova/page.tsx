import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { LeadershipForm } from '@/components/campaign/LeadershipForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadOrganizationOptions, loadPlazaOptions } from '@/utilities/campaignRelationOptions'
import { createLeadershipFormAction } from './formActions'

type NewLeadershipPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewLeadershipPage({ searchParams }: NewLeadershipPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const [plazaOptions, organizationOptions] = await Promise.all([
    loadPlazaOptions(payload, user),
    loadOrganizationOptions(payload, user),
  ])

  const rawInitialPlaza = Array.isArray(rawSearchParams.plaza)
    ? rawSearchParams.plaza[0]
    : rawSearchParams.plaza
  const initialPlazaID =
    rawInitialPlaza && /^[1-9]\d*$/.test(rawInitialPlaza) ? Number(rawInitialPlaza) : null
  const initialPlazaIDs =
    initialPlazaID && plazaOptions.some((option) => option.id === initialPlazaID)
      ? [initialPlazaID]
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
        plazaOptions={plazaOptions}
        organizationOptions={organizationOptions}
        initialPlazaIDs={initialPlazaIDs}
        formAction={createLeadershipFormAction}
      />
    </CampaignPageShell>
  )
}
