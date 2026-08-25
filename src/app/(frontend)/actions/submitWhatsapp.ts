'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { WHATSAPP_SUBSCRIPTION_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { WhatsAppFormInput, whatsAppFormSchema } from '@/lib/schemas/whatsapp-form'
import { requireConsentByKey } from '@/utilities/campaignConsent'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const submitWhatsapp = async (input: WhatsAppFormInput) => {
  const { comment, ...contactInput } = whatsAppFormSchema.parse(input)
  const payload = await getPayload({ config })

  // Fail-closed consent resolution by stable key (Pass 2 D3) — the flow
  // refuses to record a subscription while the keyed Consent document is
  // missing, same policy as the campaign flows. Resolved before the
  // transaction because it is a read, not a write.
  const consent = await requireConsentByKey(
    payload,
    WHATSAPP_SUBSCRIPTION_CONSENT_KEY,
    undefined,
    'Consentimento da inscrição no WhatsApp ainda não configurado.',
  )

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const { phone, ...contactFields } = contactInput
      const contact = await payload.create({
        collection: 'contact',
        data: {
          ...contactFields,
          // The public forms keep a single phone input; the ficha stores the
          // phones array with that number as primary (C112).
          phones: phone ? [{ value: phone }] : [],
        },
        req,
      })

      await payload.create({
        collection: 'subscription',
        data: {
          contact: contact.id,
          consent: consent.id,
          comment,
        },
        req,
      })

      return { ok: true }
    },
    { beginFailureMessage: 'failed to start transaction' },
  )
}
