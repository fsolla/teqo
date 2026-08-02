import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SupporterImportWizard } from '@/components/campaign/supporter/SupporterImportWizard'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { isCampaignCoordinator } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const metadata = campaignPageMetadataFromCatalog('apoiadoresImportar')

export default async function ImportSupportersPage() {
  const user = await requireCampaignPageActor()
  if (!isCampaignCoordinator(user)) redirect('/campanha/apoiadores')

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/campanha/apoiadores">← Voltar para apoiadores</Link>
      </Button>

      <SupporterImportWizard />
    </div>
  )
}
