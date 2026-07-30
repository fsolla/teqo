import { z } from 'zod'

import { campaignPasswordSchema } from '@/lib/schemas/campaignPassword'
import { leadershipGenders } from '@/lib/schemas/leadership'
import {
  brazilianMobile,
  nullablePersistedEmail,
  positiveRelationshipId,
} from '@/lib/schemas/primitives'

const tokenSchema = z.string().min(20).max(256)

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

const campaignInviteProfileSchema = z.object({
  token: tokenSchema,
  name: z.string().trim().min(2).max(120),
  phone: brazilianMobile,
  email: nullablePersistedEmail,
  gender: optionalEnum(leadershipGenders),
})

export const campaignInviteCreateSchema = z.object({
  leadership: positiveRelationshipId,
  kind: z.enum(['login', 'autopreenchimento']),
})

export const campaignInviteAutofillSchema = campaignInviteProfileSchema.extend({
  consentAccepted: z.boolean().optional(),
})

export const campaignInviteLoginSchema = campaignInviteProfileSchema.extend({
  password: campaignPasswordSchema,
  consentAccepted: z.boolean().optional(),
})

export type CampaignInviteCreateInput = z.input<typeof campaignInviteCreateSchema>
export type CampaignInviteAutofillInput = z.input<typeof campaignInviteAutofillSchema>
export type CampaignInviteLoginInput = z.input<typeof campaignInviteLoginSchema>
