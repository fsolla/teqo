import { NextResponse } from 'next/server'

import {
  buildCampaignServiceWorkerScript,
  CAMPAIGN_PWA_SCOPE,
  resolveCampaignPwaBuildId,
} from '@/utilities/campaignPwa'

// Built once per deploy; build id in the script body still invalidates SW updates.
export const dynamic = 'force-static'

export function GET(): NextResponse {
  const script = buildCampaignServiceWorkerScript(resolveCampaignPwaBuildId())

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': CAMPAIGN_PWA_SCOPE,
    },
  })
}
