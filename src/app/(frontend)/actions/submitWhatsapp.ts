'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { WhatsAppFormInput, whatsAppFormSchema } from '@/lib/schemas/whatsapp-form'

export const submitWhatsapp = async (input: WhatsAppFormInput) => {
  const { comment, ...contactInput } = whatsAppFormSchema.parse(input)
  const payload = await getPayload({ config })

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
