import { NextResponse } from 'next/server'

import {
  buildCampaignServiceWorkerScript,
  CAMPAIGN_PWA_SCOPE,
  resolveCampaignPwaBuildId,
} from '@/utilities/campaignPwa'

// Dynamic on purpose (D6): deploys are CLI `vercel build` + `--prebuilt`, so the
// Vercel build-time envs (`VERCEL_GIT_COMMIT_SHA`/`VERCEL_DEPLOYMENT_ID`) are not
// present when a `force-static` route is prerendered — prod was serving `dev` as
// the cache name, so SW caches never versioned per deploy. `VERCEL_DEPLOYMENT_ID`
// IS set at runtime, which makes the build id unique per deployment.
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
