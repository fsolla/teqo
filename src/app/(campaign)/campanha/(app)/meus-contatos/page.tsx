import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LeaderContactsPanel } from '@/components/campaign/leadership/LeaderContactsPanel'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { isCampaignLeader } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadLeaderContactsPageData } from '@/utilities/leaderContactsPageData'

export const dynamic = 'force-dynamic'

export const metadata = campaignPageMetadataFromCatalog('meusContatos')

export default async function CampaignMeusContatosPage() {
  const [payload, user] = await Promise.all([getPayload({ config }), requireCampaignPageActor()])

  if (!isCampaignLeader(user)) {
    redirect('/campanha')
  }

  const view = await loadLeaderContactsPageData(payload, user)

  return (
    <LeaderContactsPanel
      municipalityOptions={view.municipalityOptions}
      defaultMunicipalityId={view.defaultMunicipalityId}
      showMunicipalitySelect={view.showMunicipalitySelect}
      registrationConsentConfigured={view.registrationConsentConfigured}
      contacts={view.contacts}
    />
  )
}
