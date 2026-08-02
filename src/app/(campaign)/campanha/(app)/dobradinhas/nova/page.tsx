import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyForm } from '@/components/campaign/stateDeputy/StateDeputyForm'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { createStateDeputyFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('dobradinhasNova')

export default async function NewStateDeputyPage() {
  await requireCampaignPageActor({ gate: 'staff' })

  return (
    <CampaignPageShell>
      <Button asChild variant="ghost" className="min-h-11 self-start">
        <Link href="/campanha/dobradinhas">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Voltar para dobradinhas
        </Link>
      </Button>

      <StateDeputyForm formAction={createStateDeputyFormAction} />
    </CampaignPageShell>
  )
}
