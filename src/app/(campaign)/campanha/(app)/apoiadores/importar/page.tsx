import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { SupporterImportWizard } from '@/components/campaign/supporter/SupporterImportWizard'
import { Button } from '@/components/ui/button'
import { isCampaignCoordinator } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'

export default async function ImportSupportersPage() {
  const user = await getCampaignUser()

  if (!user) redirect('/campanha/login')
  if (!isCampaignCoordinator(user)) redirect('/campanha/apoiadores')

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/campanha/apoiadores">← Voltar para apoiadores</Link>
        </Button>
        <CampaignScopeBadge>Importação · Coordenador Geral</CampaignScopeBadge>
        <h1 className="text-2xl font-semibold tracking-tight">Importar apoiadores via CSV</h1>
        <p className="text-muted-foreground">
          Envie uma planilha, confira a prévia e confirme a importação em lote.
        </p>
      </header>

      <SupporterImportWizard />
    </div>
  )
}
