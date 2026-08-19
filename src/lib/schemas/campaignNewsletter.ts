import { brazilianMobile, optionalPersistedEmail } from '@/lib/schemas/primitives'
import { z } from 'zod'

import { commentSchema } from './comment'
import { contactCityFieldSchema, contactNameSchema, optionalContactStateSchema } from './contact'

/**
 * S9 — the campaign home "novidades" capture. Name + WhatsApp are required
 * (the phone feeds the campaign's WhatsApp groups); email, state, city and
 * comment are optional. `campaignLevel` carries the pre-selected engagement
 * toggle: 'time' (frequent communications + WhatsApp groups + actions) or
 * 'esporadico' (occasional communications only) — recorded on the
 * subscription so the admin can tell who may join groups.
 */
export const campaignNewsletterSchema = z.object({
  name: contactNameSchema,
  phone: brazilianMobile,
  email: optionalPersistedEmail,
  state: optionalContactStateSchema,
  city: contactCityFieldSchema,
  comment: commentSchema.shape.comment,
  campaignLevel: z.enum(['time', 'esporadico']).default('time'),
})

export type CampaignNewsletterInput = z.input<typeof campaignNewsletterSchema>
