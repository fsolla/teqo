import {
  ACTIVITY_DEMAND_DUPLICATE_MESSAGE,
  ACTIVITY_DUPLICATE_TITLE_MESSAGE,
  ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE,
} from '@/lib/activityOverlayMessages'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'

/**
 * C123 — unified error mapping for the agenda's single create/edit overlay.
 * Pure, so both the server actions and the unit tests share one source of
 * truth. DB unique-violations surface as named field errors (same strings the
 * old full-form actions used), everything else collapses to a generic message.
 */
export type ActivityOverlayErrorResult = {
  message: string
  fieldErrors?: Record<string, string[]>
}

export const mapActivityOverlayError = (error: unknown): ActivityOverlayErrorResult => {
  if (
    error instanceof Error &&
    /campaign_demand.*(?:slug|title)|campaignDemand.*(?:slug|title)/i.test(error.message)
  ) {
    return {
      message: ACTIVITY_DEMAND_DUPLICATE_MESSAGE,
      fieldErrors: { demandsJson: [ACTIVITY_DEMAND_DUPLICATE_MESSAGE] },
    }
  }
  if (error instanceof Error && /já existe|unique|duplicate key/i.test(error.message)) {
    return {
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    }
  }
  const mapped = mapCampaignFormActionError({
    error,
    genericMessage: ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE,
  })
  return {
    message: mapped.message ?? ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE,
    ...(mapped.fieldErrors ? { fieldErrors: mapped.fieldErrors } : {}),
  }
}
