/**
 * Named bookmarks of the municipality list URL (B18). The storage layer moved
 * to the shared `createSavedFilterStore` factory (2nd call site: C100 people);
 * this module keeps the B18 public API byte-for-byte so the sidebar, the save
 * control and the unit suite keep working unchanged.
 */

import {
  createSavedFilterStore,
  SAVED_FILTER_MAX_ENTRIES,
  SAVED_FILTER_MAX_NAME_LENGTH,
  type CampaignSavedFilter,
  type SaveCampaignSavedFilterResult,
} from '@/utilities/campaignSavedFilterStore'

export const STORAGE_KEY = 'teqo:campaign:municipality-saved-filters'

export type MunicipalitySavedFilter = CampaignSavedFilter

export type SaveMunicipalitySavedFilterResult = SaveCampaignSavedFilterResult

export { SAVED_FILTER_MAX_ENTRIES as MAX_ENTRIES, SAVED_FILTER_MAX_NAME_LENGTH as MAX_NAME_LENGTH }

const store = createSavedFilterStore({
  storageKey: STORAGE_KEY,
  isHrefValid: (href) => href.startsWith('/campanha/municipios'),
})

export const listMunicipalitySavedFilters = store.list

export const saveMunicipalitySavedFilter: (
  entry: MunicipalitySavedFilter,
) => SaveMunicipalitySavedFilterResult = store.save

export const removeMunicipalitySavedFilter = store.remove

export const subscribeMunicipalitySavedFilters = store.subscribe

/** Legacy B18 disclosure key — removed by B124; cleared on logout. */
const LEGACY_OPEN_STORAGE_KEY = 'teqo:campaign:municipality-saved-filters-open'

export const clearMunicipalitySavedFilters = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LEGACY_OPEN_STORAGE_KEY)
  } catch {
    // A stale preference is a nicety.
  }
  store.clear()
}
