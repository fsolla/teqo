import {
  CAMPAIGN_CACHE_PREFIX,
  CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE,
} from '@/utilities/campaignPwa'

/** Best-effort Cache API wipe on logout. SW cannot be messaged from a server action. */
export const clearCampaignPwaCaches = async (): Promise<void> => {
  try {
    if (!('caches' in window)) return
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CAMPAIGN_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    )
  } catch {
    // Cache API can throw in private mode / when storage is unavailable.
  }

  // Notify an active SW so it can drop any in-flight cache work; page already wiped Storage.
  try {
    navigator.serviceWorker?.controller?.postMessage({
      type: CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE,
    })
  } catch {
    // No controller, or postMessage rejected — safe to ignore.
  }
}
