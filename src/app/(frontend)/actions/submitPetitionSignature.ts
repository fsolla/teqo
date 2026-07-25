'use server'

import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import config from '@payload-config'
import { getPayload } from 'payload'

type SubmitPetitionSignatureInput = PetitionFormInput & {
  petitionId: string
  consentId: number
}

export const submitPetitionSignature = async ({
  petitionId,
  consentId,
  comment,
  ...contactInput
}: SubmitPetitionSignatureInput) => {
  const data = petitionFormSchema.parse(contactInput)
  const payload = await getPayload({ config })

  const transactionID = await payload.db.beginTransaction()

  if (!transactionID) {
    throw new Error('Failed to begin transaction')
  }

  try {
    const contact = await payload.create({
      collection: 'contact',
      data,
      req: { transactionID },
    })

    await Promise.all([
      payload.create({
        collection: 'signature',
        data: {
          contact: contact.id,
          petition: petitionId,
          consent: consentId,
          comment,
        },
        req: { transactionID },
      }),
      payload.create({
        collection: 'subscription',
        data: {
          contact: contact.id,
          consent: consentId,
        },
        req: { transactionID },
      }),
    ])

    const { totalDocs: signatureNumber } = await payload.count({
      collection: 'signature',
      where: { petition: { equals: petitionId } },
      req: { transactionID },
    })

    await payload.db.commitTransaction(transactionID)
    return { ok: true, signatureNumber }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
