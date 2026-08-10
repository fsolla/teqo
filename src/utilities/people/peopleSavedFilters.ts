/**
 * Named bookmarks of the people list URL (C100) — the 2nd call site of the B18
 * pattern, specialized per the FD2 veto: this store is concrete and
 * device-local, backed by the shared storage factory.
 */

import {
  createSavedFilterStore,
  SAVED_FILTER_MAX_ENTRIES,
  SAVED_FILTER_MAX_NAME_LENGTH,
  type CampaignSavedFilter,
  type SaveCampaignSavedFilterResult,
} from '@/utilities/campaignSavedFilterStore'

export const STORAGE_KEY = 'teqo:campaign:people-saved-filters'

export type PeopleSavedFilter = CampaignSavedFilter

export type SavePeopleSavedFilterResult = SaveCampaignSavedFilterResult

export { SAVED_FILTER_MAX_ENTRIES as MAX_ENTRIES, SAVED_FILTER_MAX_NAME_LENGTH as MAX_NAME_LENGTH }

const store = createSavedFilterStore({
  storageKey: STORAGE_KEY,
  isHrefValid: (href) => href.startsWith('/campanha/pessoas'),
})

export const listPeopleSavedFilters = store.list

export const savePeopleSavedFilter: (entry: PeopleSavedFilter) => SavePeopleSavedFilterResult =
  store.save

export const removePeopleSavedFilter = store.remove

export const clearPeopleSavedFilters = store.clear

export const subscribePeopleSavedFilters = store.subscribe
