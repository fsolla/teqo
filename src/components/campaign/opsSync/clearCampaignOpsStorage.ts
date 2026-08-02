'use client'

import { clearOpsEstimateOutboxForLogout } from '@/components/campaign/opsSync/opsEstimateOutbox'
import {
  abortOpsMirrorSync,
  clearOpsMirrorPersistenceForLogout,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { clearOpsMunicipalityOutboxForLogout } from '@/components/campaign/opsSync/opsMunicipalityOutbox'

/**
 * Logout wipe for campaignOps mirror + outbox (OH1/OH11).
 *
 * Order: abort in-flight sync → outbox → persistence → (caller clears Cache API).
 */
export const clearCampaignOpsStorage = async (): Promise<void> => {
  abortOpsMirrorSync()
  await Promise.all([clearOpsEstimateOutboxForLogout(), clearOpsMunicipalityOutboxForLogout()])
  await clearOpsMirrorPersistenceForLogout()
}
