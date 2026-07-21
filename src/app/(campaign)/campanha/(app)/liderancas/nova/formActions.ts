'use server'

import { redirect } from 'next/navigation'

import { createLeadership } from '@/app/(campaign)/campanha/actions/leadership'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const safeMessages = [
  'Esta pessoa já está cadastrada como liderança. Edite a ficha existente para vincular novas Praças.',
  'Você só pode vincular lideranças às Praças que assessora.',
  'Somente a coordenação e a assessoria podem gerenciar lideranças.',
  'Existe mais de um contato com este celular. Resolva a duplicidade no admin antes de continuar.',
] as const

export const createLeadershipFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  let createdId: number | null = null
  try {
    const sector = optionalFormText(formData, 'sector')
    const supportStatus = optionalFormText(formData, 'supportStatus')

    const leadership = await createLeadership({
      name: requiredFormText(formData, 'name'),
      phone: requiredFormText(formData, 'phone'),
      email: optionalFormText(formData, 'email'),
      plazas: repeatedRelationshipFormValues(formData, 'plazas'),
      organizations: repeatedRelationshipFormValues(formData, 'organizations'),
      sector: leadershipSectors.includes(sector as (typeof leadershipSectors)[number])
        ? (sector as (typeof leadershipSectors)[number])
        : undefined,
      supportStatus: leadershipSupportStatuses.includes(
        supportStatus as (typeof leadershipSupportStatuses)[number],
      )
        ? (supportStatus as (typeof leadershipSupportStatuses)[number])
        : 'a_abordar',
      notes: optionalFormText(formData, 'notes'),
      consentNote: optionalFormText(formData, 'consentNote'),
    })
    createdId = leadership.id
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages,
      genericMessage:
        'Não foi possível cadastrar a liderança. Verifique os dados e tente novamente.',
    })
  }

  redirect(`/campanha/liderancas/${createdId}`)
}
