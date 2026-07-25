'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { WHATSAPP_SUBSCRIPTION_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { WhatsAppFormInput, whatsAppFormSchema } from '@/lib/schemas/whatsapp-form'
import { requireConsentByKey } from '@/utilities/campaignConsent'

export const submitWhatsapp = async (input: WhatsAppFormInput) => {
  const { comment, ...contactInput } = whatsAppFormSchema.parse(input)
  const payload = await getPayload({ config })

  // Fail-closed consent resolution by stable key (Pass 2 D3) — the flow
  // refuses to record a subscription while the keyed Consent document is
  // missing, same policy as the campaign flows.
  const consent = await requireConsentByKey(
    payload,
    WHATSAPP_SUBSCRIPTION_CONSENT_KEY,
    undefined,
    'Consentimento da inscrição no WhatsApp ainda não configurado.',
  )

  const transactionID = await payload.db.beginTransaction()

  if (!transactionID) {
    throw new Error('failed to start transaction')
  }

  try {
    const contact = await payload.create({
      collection: 'contact',
      data: contactInput,
      req: { transactionID },
    })

    await payload.create({
      collection: 'subscription',
      data: {
        contact: contact.id,
        consent: consent.id,
        comment,
      },
      req: { transactionID },
    })

    await payload.db.commitTransaction(transactionID)

    return { ok: true }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)

    throw error
  }
}
