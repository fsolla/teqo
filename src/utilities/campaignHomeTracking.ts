import 'server-only'

import { normalizeFacebookPixelId } from '@/lib/facebookPixel'
import { getCachedGlobal } from '@/utilities/globalReads'

/**
 * S10 — the Meta pixel configured in `SiteSettings.tracking` for the public
 * campaign page. Cached under `global_site-settings`, so an admin edit of the
 * global already revalidates the home (the `afterChange` hook busts the tag).
 * Fail-closed: no configured ID → null → nothing renders on the page.
 */
export const getCampaignHomeMetaPixelId = async (): Promise<string | null> => {
  const settings = await getCachedGlobal('site-settings')()
  return normalizeFacebookPixelId(settings.tracking?.facebookPixelId)
}
