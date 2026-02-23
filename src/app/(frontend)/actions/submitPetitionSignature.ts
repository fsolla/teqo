'use server'

import config from '@payload-config'
import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import { getPayload } from 'payload'

type SubmitPetitionSignatureInput = PetitionFormInput & {
  petitionId: string
  consentId: number
}

export const submitPetitionSignature = async (input: SubmitPetitionSignatureInput) => {
  const { petitionId, consentId, ...contactInput } = input
  const data = petitionFormSchema.parse(contactInput)
  const payload = await getPayload({ config })

  const contact = await payload.create({
    collection: 'contact',
    data,
  })

  await payload.create({
    collection: 'signature',
    data: {
      contact: contact.id,
      petition: petitionId,
      consent: consentId,
    },
  })

  return { ok: true as const }
}
