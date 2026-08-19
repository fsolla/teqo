'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { CampaignNewsletterInput, campaignNewsletterSchema } from '@/lib/schemas/campaignNewsletter'
import { requireCampaignNewsletterConsent } from '@/utilities/campaignConsent'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * S9 — public home capture: name + WhatsApp (required) with an optional
 * email/state/city/comment and the engagement-level toggle. Mirrors
 * `submitWhatsapp` (fail-closed consent by stable key): while the admin has
 * not created the `campanha-novidades` Consent row, the form refuses to record
 * anything. The toggle choice survives as `subscription.campaignLevel` — never
 * a `supporter` (jurídico-blocked).
 */
export const submitCampaignNewsletter = async (input: CampaignNewsletterInput) => {
  const parsed = campaignNewsletterSchema.parse(input)
  const payload = await getPayload({ config })

  const consent = await requireCampaignNewsletterConsent(payload)

  return withPayloadTransaction(payload, async ({ req }) => {
    const { comment, campaignLevel, phone, ...contactFields } = parsed
    const contact = await payload.create({
      collection: 'contact',
      data: {
        ...contactFields,
        // Same shape as the public WhatsApp form: the phones array with the
        // captured number as primary (C112).
        phones: [{ value: phone }],
      },
      req,
    })

    await payload.create({
      collection: 'subscription',
      data: {
        contact: contact.id,
        consent: consent.id,
        campaignLevel,
        comment,
      },
      req,
    })

    return { ok: true }
  })
}
