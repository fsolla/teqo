import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { OrganizationForm } from '@/components/campaign/OrganizationForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { createOrganizationFormAction } from './formActions'

export default async function NewOrganizationPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const municipalityOptions = await loadMunicipalityOptions(payload, user)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/organizacoes">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para organizações
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova organização</h1>
        <p className="text-muted-foreground">
          Cadastre sindicatos, associações, movimentos e afins para vincular lideranças e Planos de
          Ação.
        </p>
      </header>

      <OrganizationForm municipalityOptions={municipalityOptions} formAction={createOrganizationFormAction} />
    </CampaignPageShell>
  )
}
