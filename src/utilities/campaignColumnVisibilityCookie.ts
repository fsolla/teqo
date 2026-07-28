import 'server-only'

import { cookies } from 'next/headers'

import {
  CAMPAIGN_COLUMNS_COOKIE,
  parseCampaignHiddenColumns,
  type CampaignColumnVisibility,
  type CampaignListId,
} from '@/lib/campaignColumnVisibility'

/**
 * B17 — what this device hid on one list, ready to hand to `<CampaignTable>`.
 * Called by whichever server component renders the table; `/campanha` is
 * already dynamic (auth), so reading a cookie costs no caching.
 */
export const readCampaignColumnVisibility = async (
  listId: CampaignListId,
): Promise<CampaignColumnVisibility> => {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CAMPAIGN_COLUMNS_COOKIE)?.value

  return { listId, hiddenColumnIds: parseCampaignHiddenColumns(raw)[listId] ?? [] }
}
