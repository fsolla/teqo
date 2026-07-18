import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import { CampaignDashboard } from '@/components/campaign/CampaignDashboard'
import { getCampaignDashboardPageData } from '@/utilities/campaignDashboardPageData'
import { getCampaignUser } from '@/utilities/campaignAuth'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) redirect('/campanha/login')

  const now = new Date()
  const view = await getCampaignDashboardPageData(payload, user, now)
  return <CampaignDashboard view={view} now={now} />
}
