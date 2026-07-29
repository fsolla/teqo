import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  await requireCampaignPageActor()

  return <CampaignPageShell aria-label="Início">{null}</CampaignPageShell>
}
