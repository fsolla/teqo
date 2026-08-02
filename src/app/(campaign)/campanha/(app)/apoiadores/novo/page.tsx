import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { createSupporterFormAction } from '@/app/(campaign)/campanha/(app)/apoiadores/novo/formActions'
import { SupporterForm } from '@/components/campaign/supporter/SupporterForm'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadSupporterCreatePageData } from '@/utilities/supporter/supporterPageData'
import { canAccessSupporterArea } from '@/utilities/supporter/supporterUi'

export const metadata = campaignPageMetadataFromCatalog('apoiadoresNovo')

export default async function NewSupporterPage() {
  const [user, payload] = await Promise.all([requireCampaignPageActor(), getPayload({ config })])

  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  const pageData = await loadSupporterCreatePageData(payload, user)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/campanha/apoiadores">← Voltar para apoiadores</Link>
      </Button>

      <SupporterForm
        action={createSupporterFormAction}
        municipalityOptions={pageData.municipalityOptions}
        registrationConsentConfigured={pageData.registrationConsentConfigured}
        voteIntentionConsentConfigured={pageData.voteIntentionConsentConfigured}
        requireMunicipality={pageData.requireMunicipality}
      />
    </div>
  )
}
