import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { DemandForm } from '@/components/campaign/DemandForm'
import { Button } from '@/components/ui/button'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadPlazaOptions } from '@/utilities/campaignRelationOptions'
import { createDemandFormAction } from './formActions'

export default async function NewDemandPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')

  const plazaOptions = await loadPlazaOptions(payload, user)

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

      <DemandForm plazaOptions={plazaOptions} formAction={createDemandFormAction} />
    </CampaignPageShell>
  )
}
