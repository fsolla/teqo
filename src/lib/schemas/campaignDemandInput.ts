import { z } from 'zod'

import {
  CAMPAIGN_DEMAND_BODY_MAX_LENGTH,
  campaignDemandKinds,
  campaignDemandStatuses,
} from '@/lib/schemas/campaignDemand'
import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'

export const campaignDemandCreateSchema = z.object({
  kind: z.enum(campaignDemandKinds),
  /**
   * The single free-text field (B195): what + details. `title` is derived
   * server-side by AI with a truncation fallback — never sent by the forms.
   */
  description: z.string().trim().min(2).max(CAMPAIGN_DEMAND_BODY_MAX_LENGTH),
  municipality: positiveRelationshipId,
  activity: positiveRelationshipId.optional(),
  /** Staff may record on behalf of a leadership; leaders get their own. */
  leadership: positiveRelationshipId.optional(),
})

export const campaignDemandUpdateSchema = z.object({
  id: positiveRelationshipId,
  description: z.string().trim().min(2).max(CAMPAIGN_DEMAND_BODY_MAX_LENGTH),
})

export const campaignDemandTransitionSchema = z.object({
  id: positiveRelationshipId,
  status: z.enum(campaignDemandStatuses),
  decisionNote: trimmedNullableText(2000),
})

export const campaignDemandCostSchema = z.object({
  id: positiveRelationshipId,
  cost: z.number().min(0).max(100_000_000).nullable(),
})

export type CampaignDemandCreateInput = z.input<typeof campaignDemandCreateSchema>
export type CampaignDemandUpdateInput = z.input<typeof campaignDemandUpdateSchema>
export type CampaignDemandTransitionInput = z.input<typeof campaignDemandTransitionSchema>
export type CampaignDemandCostInput = z.input<typeof campaignDemandCostSchema>
