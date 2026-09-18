import { redirect } from 'next/navigation'

import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

/**
 * C154 — the communication vertical home. The assessor's job IS the search, so
 * the vertical opens directly on the acervo; the route exists so the nav has a
 * stable destination and future vertical items have a home.
 */
export default async function CommunicationHomePage() {
  await requireCampaignPageActor({ gate: 'communicationCatalog' })
  redirect(CAMPAIGN_COMMUNICATION_ACERVO)
}
