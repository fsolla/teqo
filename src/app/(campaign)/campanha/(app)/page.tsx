import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignDashboard } from '@/components/campaign/CampaignDashboard'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getCampaignDashboardData } from '@/utilities/campaignDashboardData'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) redirect('/campanha/login')

  const view = await getCampaignDashboardData(payload, user)
  return <CampaignDashboard view={view} userName={user.name} />
}
