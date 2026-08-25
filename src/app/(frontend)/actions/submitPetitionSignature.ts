'use server'

import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import config from '@payload-config'
import { getPayload } from 'payload'

import { withPayloadTransaction } from '@/utilities/payloadTransaction'

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
  // the input boundary above, so a tampered one is inert. Resolved before the
  // transaction because it is a read, not a write.
  const petition = await payload.findByID({
    collection: 'petition',
    id: petitionId,
    depth: 0,
  })
  const consentId =
    typeof petition.form.consent === 'number' ? petition.form.consent : petition.form.consent.id

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const { phone, ...contactFields } = data
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

      await Promise.all([
        payload.create({
          collection: 'signature',
          data: {
            contact: contact.id,
            petition: petitionId,
            consent: consentId,
            comment,
          },
          req,
        }),
        payload.create({
          collection: 'subscription',
          data: {
            contact: contact.id,
            consent: consentId,
          },
          req,
        }),
      ])

      const { totalDocs: signatureNumber } = await payload.count({
        collection: 'signature',
        where: { petition: { equals: petitionId } },
        req,
      })

      return { ok: true, signatureNumber }
    },
    { beginFailureMessage: 'Failed to begin transaction' },
  )
}
