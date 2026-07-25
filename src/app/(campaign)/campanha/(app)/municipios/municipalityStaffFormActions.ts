'use server'

import {
  assignMunicipalityAdvisors,
  setMunicipalityExpectedVotes,
  setMunicipalityPoliticalTrend,
} from '@/app/(campaign)/campanha/actions/municipality'
import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  checkboxFormValue,
  nullableFormText,
  optionalFormText,
  optionalMunicipalitySlugFromForm,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
  voteEstimateScenarioFromForm,
} from '@/lib/formData'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/municipality'
import { parseMunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidateMunicipalityListPaths } from '@/utilities/municipalityRevalidation'

import { municipalityStaffEditSafeMessages } from './municipalityStaffEditMessages'

export const setMunicipalityExpectedVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
    const expectedVotes = voteEstimateScenarioFromForm(formData, 'expectedVotes')

    await setMunicipalityExpectedVotes({ municipality, expectedVotes })
    revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
    return { status: 'success', message: 'Votos estimados atualizados.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: municipalityStaffEditSafeMessages,
      genericMessage:
        'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
    })
  }
}

export const setMunicipalityPoliticalTrendFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
    const status = parsePoliticalTrendStatusFormValue(optionalFormText(formData, 'trendStatus'))

    await setMunicipalityPoliticalTrend({
      municipality,
      status,
      note: nullableFormText(formData, 'trendNote'),
    })
    revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
    return { status: 'success', message: 'Tendência política registrada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: municipalityStaffEditSafeMessages,
      genericMessage:
        'Não foi possível registrar a tendência. Verifique seu acesso e tente novamente.',
    })
  }
}

export const assignMunicipalityAdvisorsFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
    const advisors = repeatedRelationshipFormValues(formData, 'advisors')

    await assignMunicipalityAdvisors({ municipality, advisors })
    revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
    return { status: 'success', message: 'Assessores atualizados.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação geral ou o candidato designa assessores.'],
      genericMessage:
        'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
    })
  }
}

export const createMunicipalityListSignalFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const municipality = requiredRelationshipFormValue(formData, 'municipalityId')

    await createMunicipalityUpdate({
      municipality,
      kind: 'sinal',
      body: optionalFormText(formData, 'body'),
      signalType: parseMunicipalitySignalType(optionalFormText(formData, 'signalType')),
      signalSource: optionalFormText(formData, 'signalSource'),
      triangulated: checkboxFormValue(formData, 'triangulated'),
    })
    revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
    return { status: 'success', message: 'Sinal registrado.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage: 'Não foi possível registrar o sinal. Verifique seu acesso e tente novamente.',
    })
  }
}
