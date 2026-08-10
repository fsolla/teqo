import { NextResponse } from 'next/server'

import {
  buildCampaignServiceWorkerScript,
  CAMPAIGN_PWA_SCOPE,
  resolveCampaignPwaBuildId,
} from '@/utilities/campaignPwa'

// Runtime env only: CLI `--prebuilt` builds have no VERCEL_* build-time envs
// (prod served `campanha-dev`); `VERCEL_DEPLOYMENT_ID` exists at runtime.
export const dynamic = 'force-dynamic'

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
