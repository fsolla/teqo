'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { upsertContactByPhone } from '@/app/(campaign)/campanha/actions/supporter'
import { checkboxFormValue, nullableRelationshipFormValue, optionalFormText } from '@/lib/formData'
import { leaderSupporterCreateSchema } from '@/lib/schemas/supporter'
import type { CampaignUser, Supporter } from '@/payload-types'
import { getEngagedLeaderMunicipalityIds, isCampaignLeader } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import {
  requireConsentByKey,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
} from '@/utilities/campaignConsent'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'
import { acquireContactPhoneLocks } from '@/utilities/contactPhoneInvariant'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { sanitizeBrazilianPhoneInput } from '@/lib/phone'
import { isUniqueSupporterConflict } from '@/utilities/supporterErrors'

export type LeaderSupporterFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  values?: LeaderSupporterFormValues
  revision?: number
}

export type LeaderSupporterFormValues = {
  name?: string
  phone?: string
  city?: string
  municipality?: string
}

const MUNICIPALITY_OUT_OF_SCOPE_MESSAGE =
  'Você só pode cadastrar contatos nos municípios da sua liderança.'

const safeActionMessages = [
  'Esta pessoa já está cadastrada como apoiador neste município.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
  'Somente lideranças podem cadastrar contatos por aqui.',
  'Consentimento de cadastro de apoiador ainda não configurado.',
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
    throw new Error('Somente lideranças podem cadastrar contatos por aqui.')
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

        const registrationConsent = await requireConsentByKey(
          payload,
          SUPPORTER_REGISTRATION_CONSENT_KEY,
          req,
          'Consentimento de cadastro de apoiador ainda não configurado.',
        )

        if (payload.db.name !== 'postgres') {
          throw new Error('O bloqueio de deduplicação exige o adaptador PostgreSQL.')
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
      throw new Error('Esta pessoa já está cadastrada como apoiador neste município.')
    }
    throw error
  }
}

export const createLeaderSupporter = async (input: unknown) => {
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
