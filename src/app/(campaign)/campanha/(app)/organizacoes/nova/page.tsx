import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

import { OrganizationForm } from '@/components/campaign/organization/OrganizationForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { Button } from '@/components/ui/button'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { createOrganizationFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('organizacoesNova')

export default async function NewOrganizationPage() {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const municipalityOptions = await loadMunicipalityOptions(payload, user)

  return (
    <CampaignPageShell>
      <Button asChild variant="ghost" className="min-h-11 self-start">
        <Link href="/campanha/organizacoes">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Voltar para organizações
        </Link>
      </Button>

      <OrganizationForm
        municipalityOptions={municipalityOptions}
        formAction={createOrganizationFormAction}
      />
    </CampaignPageShell>
  )
}
