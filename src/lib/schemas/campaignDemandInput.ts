import { z } from 'zod'

import { campaignDemandKinds, campaignDemandStatuses } from '@/lib/schemas/campaignDemand'
import {
  positiveRelationshipId,
  trimmedNullableText,
  trimmedOptionalText,
} from '@/lib/schemas/primitives'

export const campaignDemandCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(campaignDemandKinds),
  description: trimmedOptionalText(4000),
  municipality: positiveRelationshipId,
  actionPlan: positiveRelationshipId.optional(),
  /** Staff may record on behalf of a leadership; leaders get their own. */
  leadership: positiveRelationshipId.optional(),
})

export const campaignDemandDetailsUpdateSchema = z.object({
  id: positiveRelationshipId,
  kind: z.enum(campaignDemandKinds).optional(),
  description: trimmedNullableText(4000),
  actionPlan: positiveRelationshipId.nullable().optional(),
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
export type CampaignDemandDetailsUpdateInput = z.input<typeof campaignDemandDetailsUpdateSchema>
export type CampaignDemandTransitionInput = z.input<typeof campaignDemandTransitionSchema>
export type CampaignDemandCostInput = z.input<typeof campaignDemandCostSchema>
