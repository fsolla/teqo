import type { CampaignUser } from '@/payload-types'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'

export const CAMPAIGN_TOKEN_COOKIE = 'campaign-token'

export const getCampaignUser = async (): Promise<CampaignUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(CAMPAIGN_TOKEN_COOKIE)?.value

  if (!token) return null

  const payload = await getPayload({ config: configPromise })

  const headers = new Headers({ Authorization: `JWT ${token}` })

  const { user } = await payload.auth({ headers })

  if (user?.collection !== 'campaignUser') return null

  return user
}
