import { NextResponse } from 'next/server'

import { CAMPAIGN_WEB_MANIFEST } from '@/utilities/campaignPwa'

export const dynamic = 'force-static'

export function GET(): NextResponse {
  return NextResponse.json(CAMPAIGN_WEB_MANIFEST, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
