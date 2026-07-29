'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { upsertContactByPhone } from '@/app/(campaign)/campanha/actions/supporter'
import { SUPPORTER_REGISTRATION_CONSENT_MISSING_MESSAGE } from '@/lib/campaignConsentKeys'
import { checkboxFormValue, nullableRelationshipFormValue, optionalFormText } from '@/lib/formData'
import { sanitizeBrazilianPhoneInput } from '@/lib/phone'
import {
  LEADER_SUPPORTER_ONLY_MESSAGE,
  leaderSupporterCreateSchema,
  SUPPORTER_DUPLICATE_MESSAGE,
} from '@/lib/schemas/supporter'
import type { CampaignUser, Supporter } from '@/payload-types'
import { getEngagedLeaderMunicipalityIds, isCampaignLeader } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { requireSupporterRegistrationConsent } from '@/utilities/campaignConsent'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import {
  acquireContactPhoneLocks,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
} from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { POSTGRES_DEDUP_LOCK_MESSAGE } from '@/utilities/postgresTransactionLocks'
import { isUniqueSupporterConflict } from '@/utilities/supporter/supporterErrors'

export type LeaderSupporterFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  values?: LeaderSupporterFormValues
  revision?: number
}

type LeaderSupporterFormValues = {
  name?: string
  phone?: string
  city?: string
  municipality?: string
}

const MUNICIPALITY_OUT_OF_SCOPE_MESSAGE =
  'Você só pode cadastrar contatos nos municípios da sua liderança.'

const safeActionMessages = [
  SUPPORTER_DUPLICATE_MESSAGE,
  CONTACT_PHONE_AMBIGUOUS_MESSAGE,
  LEADER_SUPPORTER_ONLY_MESSAGE,
  SUPPORTER_REGISTRATION_CONSENT_MISSING_MESSAGE,
  MUNICIPALITY_OUT_OF_SCOPE_MESSAGE,
] as const

const getLeaderSupporterFormError = (
  error: unknown,
  values?: LeaderSupporterFormValues,
  revision?: number,
): LeaderSupporterFormState =>
  mapCampaignFormActionError({
    error,
    safeMessages: safeActionMessages,
    genericMessage: 'Não foi possível cadastrar o contato. Verifique os dados e tente novamente.',
    values,
    revision,
  })

const getFreshLeaderActor = async (
  payload: Payload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  if (!isCampaignLeader(currentActor)) {
    throw new Error(LEADER_SUPPORTER_ONLY_MESSAGE)
  }
  return currentActor
}

export const createLeaderSupporterRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: unknown,
) => {
  const data = leaderSupporterCreateSchema.parse(input)

  try {
    return await withPayloadTransaction(
      payload,
      async ({ req }) => {
        const currentActor = await getFreshLeaderActor(payload, actor, req)

        // Leaders cannot read the municipality collection, so scope is asserted
        // against their own engaged leadership's municipalities (mirroring the
        // leader branch of the collection-level `canCreateSupporter`).
        const accessibleMunicipalityIDs = await getEngagedLeaderMunicipalityIds(
          payload,
          currentActor.id,
          req,
        )
        if (!accessibleMunicipalityIDs.includes(data.municipality)) {
          throw new Error(MUNICIPALITY_OUT_OF_SCOPE_MESSAGE)
        }

        const registrationConsent = await requireSupporterRegistrationConsent(payload, req)

        if (payload.db.name !== 'postgres') {
          throw new Error(POSTGRES_DEDUP_LOCK_MESSAGE)
        }

        await acquireContactPhoneLocks(payload, req, [data.phone])
        const { contactID, reused } = await upsertContactByPhone({
          payload,
          req,
          phone: data.phone,
          name: data.name,
          city: data.city,
        })

        const supporter = await payload.create({
          collection: 'supporter',
          data: {
            contact: contactID,
            municipality: data.municipality,
            source: 'lideranca' as Supporter['source'],
            consent: registrationConsent.id,
            consentContentHash: registrationConsent.contentHash,
            consentedAt: new Date().toISOString(),
            createdBy: currentActor.id,
          },
          depth: 0,
          overrideAccess: true,
          req,
        })

        return { ...supporter, contactReused: reused }
      },
      { beginFailureMessage: 'Não foi possível iniciar a transação de cadastro do contato.' },
    )
  } catch (error) {
    if (isUniqueSupporterConflict(error)) {
      throw new Error(SUPPORTER_DUPLICATE_MESSAGE)
    }
    throw error
  }
}

const createLeaderSupporter = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  return createLeaderSupporterRecord(payload, actor, input)
}

export const createLeaderSupporterFormAction = async (
  state: LeaderSupporterFormState,
  formData: FormData,
): Promise<LeaderSupporterFormState> => {
  let values: LeaderSupporterFormValues | undefined
  const revision = (state.revision ?? 0) + 1

  try {
    values = {
      name: optionalFormText(formData, 'name'),
      phone: optionalFormText(formData, 'phone'),
      city: optionalFormText(formData, 'city'),
      municipality: optionalFormText(formData, 'municipality'),
    }

    const phone = sanitizeBrazilianPhoneInput(values.phone ?? '')
    const municipality = nullableRelationshipFormValue(formData, 'municipality')
    const input = leaderSupporterCreateSchema.parse({
      name: values.name ?? '',
      phone,
      city: values.city,
      municipality,
      consentAccepted: checkboxFormValue(formData, 'consentAccepted') ? true : undefined,
    })

    const supporter = await createLeaderSupporter(input)
    revalidatePath('/campanha')

    return {
      status: 'success',
      message: supporter.contactReused
        ? 'Contato cadastrado. O celular já existia e foi reutilizado.'
        : 'Contato cadastrado com sucesso.',
      revision,
    }
  } catch (error) {
    return getLeaderSupporterFormError(error, values, revision)
  }
}
