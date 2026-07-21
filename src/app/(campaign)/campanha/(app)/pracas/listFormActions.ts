'use server'

import {
  assignPlazaAdvisors,
  setPlazaExpectedVotes,
  setPlazaPoliticalTrend,
} from '@/app/(campaign)/campanha/actions/plaza'
import {
  nullableFormText,
  optionalFormText,
  optionalIntegerFormValue,
  optionalPlazaSlugFromForm,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/plaza'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidatePlazaListPaths } from '@/utilities/plazaRevalidation'

export const setPlazaExpectedVotesListFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const expectedVotes =
      optionalIntegerFormValue(formData, 'expectedVotes', {
        minimum: 0,
        maximum: 1_000_000,
      }) ?? null

    await setPlazaExpectedVotes({ plaza, expectedVotes })
    revalidatePlazaListPaths({ slug: optionalPlazaSlugFromForm(formData) })
    return { status: 'success', message: 'Votos estimados atualizados.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria podem editar a Praça.'],
      genericMessage:
        'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
    })
  }
}

export const setPlazaPoliticalTrendListFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const status = parsePoliticalTrendStatusFormValue(optionalFormText(formData, 'trendStatus'))

    await setPlazaPoliticalTrend({
      plaza,
      status,
      note: nullableFormText(formData, 'trendNote'),
    })
    revalidatePlazaListPaths({ slug: optionalPlazaSlugFromForm(formData) })
    return { status: 'success', message: 'Tendência política registrada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria podem editar a Praça.'],
      genericMessage:
        'Não foi possível registrar a tendência. Verifique seu acesso e tente novamente.',
    })
  }
}

export const assignPlazaAdvisorsListFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const advisors = repeatedRelationshipFormValues(formData, 'advisors')

    await assignPlazaAdvisors({ plaza, advisors })
    revalidatePlazaListPaths({ slug: optionalPlazaSlugFromForm(formData) })
    return { status: 'success', message: 'Assessores atualizados.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente o Coordenador Geral designa assessores.'],
      genericMessage:
        'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
    })
  }
}
