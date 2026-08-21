import {
  nullableRelationshipFormValue,
  repeatedRelationshipFormValues,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { campaignDemandKinds, type CampaignDemandKind } from '@/lib/schemas/campaignDemand'
import type { CampaignDemandCreateInput } from '@/lib/schemas/campaignDemandInput'

/**
 * Shared create-form parsing for the two demand cadastros (wizard step and
 * `/demandas/nova`): same free-text field, kind coercion and municipality /
 * activity relationships — the actions only differ in the response wrapper.
 */
export const parseCampaignDemandCreateFormData = (
  formData: FormData,
): CampaignDemandCreateInput => {
  const rawKind = requiredFormText(formData, 'kind')
  return {
    kind: campaignDemandKinds.includes(rawKind as CampaignDemandKind)
      ? (rawKind as CampaignDemandKind)
      : 'outro',
    description: requiredFormText(formData, 'description'),
    municipality: requiredRelationshipFormValue(formData, 'municipalityId'),
    activity: nullableRelationshipFormValue(formData, 'activityId') ?? undefined,
    responsibles: repeatedRelationshipFormValues(formData, 'responsibles'),
  }
}
