'use server'

import { revalidatePath } from 'next/cache'

import {
  createLeadership,
  updateLeadershipInternal,
} from '@/app/(campaign)/campanha/actions/leadership'
import { updateNucleus } from '@/app/(campaign)/campanha/actions/nucleus'
import { leadershipInternalUpdateSchema } from '@/lib/schemas/leadership'
import {
  FormDataBoundaryError,
  nullableFormText,
  optionalFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { mapCampaignFormActionError } from '@/utilities/campaignFormActionError'

export type LeadershipFormState = {
  status?: 'success'
  message?: string
  fieldErrors?: Record<string, string[]>
  leadershipId?: number
  contactReused?: boolean
  values?: LeadershipFormValues
  revision?: number
}

export type LeadershipFormValues = {
  name?: string
  phone?: string
  email?: string
  gender?: string
  sector?: string
  sectorNotes?: string
  supportStatus?: string
  notes?: string
  consentNote?: string
}

const safeActionMessages = [
  'Esta pessoa já está cadastrada como liderança neste núcleo.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
  'Escolha outro contato principal antes de alterar o status desta liderança.',
  'Somente a coordenação pode gerenciar lideranças.',
] as const

const resolveLeadershipBoundaryMessage = (error: FormDataBoundaryError): string =>
  error.field === 'contact'
    ? 'Não foi possível identificar a liderança. Atualize a página e tente novamente.'
    : error.field === 'id' || error.field === 'nucleus'
      ? 'Não foi possível identificar o registro. Atualize a página e tente novamente.'
      : error.message

const getLeadershipFormError = (
  error: unknown,
  values?: LeadershipFormValues,
  revision?: number,
): LeadershipFormState =>
  mapCampaignFormActionError({
    error,
    safeMessages: safeActionMessages,
    genericMessage: 'Não foi possível salvar a liderança. Verifique os dados e tente novamente.',
    values,
    revision,
    resolveBoundaryMessage: resolveLeadershipBoundaryMessage,
  })

export const createLeadershipFormAction = async (
  state: LeadershipFormState,
  formData: FormData,
): Promise<LeadershipFormState> => {
  let values: LeadershipFormValues | undefined
  const revision = (state.revision ?? 0) + 1

  try {
    values = {
      name: optionalFormText(formData, 'name'),
      phone: optionalFormText(formData, 'phone'),
      email: optionalFormText(formData, 'email'),
      gender: optionalFormText(formData, 'gender'),
      sector: optionalFormText(formData, 'sector'),
      sectorNotes: optionalFormText(formData, 'sectorNotes'),
      supportStatus: optionalFormText(formData, 'supportStatus'),
      notes: optionalFormText(formData, 'notes'),
      consentNote: optionalFormText(formData, 'consentNote'),
    }
    const input = {
      nucleus: requiredRelationshipFormValue(formData, 'nucleus'),
      ...values,
      name: values.name ?? '',
      phone: values.phone ?? '',
    }
    const leadership = await createLeadership(input)
    revalidatePath('/campanha/nucleos/[slug]', 'page')

    return {
      status: 'success',
      message: leadership.contactReused
        ? 'Liderança cadastrada. O contato existente com este celular foi reutilizado.'
        : 'Liderança cadastrada com sucesso.',
      leadershipId: leadership.id,
      contactReused: leadership.contactReused,
    }
  } catch (error) {
    return getLeadershipFormError(error, values, revision)
  }
}

export const updateLeadershipFormAction = async (
  _state: LeadershipFormState,
  formData: FormData,
): Promise<LeadershipFormState> => {
  try {
    const input = leadershipInternalUpdateSchema.parse({
      id: requiredRelationshipFormValue(formData, 'id'),
      sector: nullableFormText(formData, 'sector'),
      sectorNotes: nullableFormText(formData, 'sectorNotes'),
      supportStatus: optionalFormText(formData, 'supportStatus'),
      notes: nullableFormText(formData, 'notes'),
      consentNote: nullableFormText(formData, 'consentNote'),
    })
    const leadership = await updateLeadershipInternal(input)
    revalidatePath('/campanha/nucleos/[slug]', 'page')

    return {
      status: 'success',
      message: 'Liderança atualizada com sucesso.',
      leadershipId: leadership.id,
    }
  } catch (error) {
    return getLeadershipFormError(error)
  }
}

export const setPrimaryContactFormAction = async (
  _state: LeadershipFormState,
  formData: FormData,
): Promise<LeadershipFormState> => {
  try {
    await updateNucleus({
      id: requiredRelationshipFormValue(formData, 'nucleus'),
      primaryContact: requiredRelationshipFormValue(formData, 'contact'),
    })
    revalidatePath('/campanha/nucleos/[slug]', 'page')

    return {
      status: 'success',
      message: 'Contato principal atualizado.',
    }
  } catch (error) {
    return getLeadershipFormError(error)
  }
}
