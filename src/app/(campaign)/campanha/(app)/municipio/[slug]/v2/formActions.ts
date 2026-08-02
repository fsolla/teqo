'use server'

import { createMunicipalityListSignalFormAction } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffFormActions'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/** Thin alias — same write path as the list signal control (B147). */
export const createMunicipalityV2SignalFormAction = async (
  formData: FormData,
): Promise<CampaignFormActionState> => createMunicipalityListSignalFormAction({}, formData)
