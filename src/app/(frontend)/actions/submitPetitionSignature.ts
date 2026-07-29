'use server'

import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import config from '@payload-config'
import { getPayload } from 'payload'

type SubmitPetitionSignatureInput = PetitionFormInput & {
  petitionId: string
}

export const submitPetitionSignature = async ({
  petitionId,
  comment,
  ...contactInput
}: SubmitPetitionSignatureInput) => {
  const data = petitionFormSchema.parse(contactInput)
  const payload = await getPayload({ config })

  // The consent document is resolved server-side from the petition itself —
  // never trusted from the client (P3-B, same policy as Pass 2 D3): the page
  // renders the text from `petition.form.consent`, and the signature must
  // record exactly that document. Petition read access is public, like the
  // page that renders it; a `consentId` posted by the client is dropped at
  // the input boundary above, so a tampered one is inert.
  const petition = await payload.findByID({
    collection: 'petition',
    id: petitionId,
    depth: 0,
  })
  const consentId =
    typeof petition.form.consent === 'number' ? petition.form.consent : petition.form.consent.id

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
