import config from '@payload-config'
import { getPayload } from 'payload'

import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE } from '@/utilities/campaignFormActionError'
import { buildOpsSnapshot } from '@/utilities/campaignOps/buildOpsSnapshot'

export const dynamic = 'force-dynamic'

/**
 * Full staff ops snapshot for the hybrid mirror (OH4). Full-only — no `?since=`.
 * Outside `(app)` so unauthenticated callers get JSON 401 instead of a login redirect.
 */
export async function GET(): Promise<Response> {
  const user = await getCampaignUser()
  if (!user) {
    return Response.json({ error: CAMPAIGN_AUTH_REQUIRED_MESSAGE }, { status: 401 })
  }

  if (!isCampaignStaff(user)) {
    return Response.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const snapshot = await buildOpsSnapshot(payload, user)

  return Response.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
