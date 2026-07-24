import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { StateDeputyForm } from '@/components/campaign/StateDeputyForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { createStateDeputyFormAction } from './formActions'

export default async function NewStateDeputyPage() {
  const user = await getCampaignUser()
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

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
