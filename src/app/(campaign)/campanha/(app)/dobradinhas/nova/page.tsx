import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyForm } from '@/components/campaign/stateDeputy/StateDeputyForm'
import { Button } from '@/components/ui/button'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { createStateDeputyFormAction } from './formActions'

export default async function NewStateDeputyPage() {
  await requireCampaignPageActor({ gate: 'staff' })

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/dobradinhas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para dobradinhas
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nova dobradinha</h1>
        <p className="text-muted-foreground">
          Cadastre deputados estaduais com quem a campanha dobra. Vincule a municípios e lideranças
          nas fichas correspondentes.
        </p>
      </header>

      <StateDeputyForm formAction={createStateDeputyFormAction} />
    </CampaignPageShell>
  )
}
