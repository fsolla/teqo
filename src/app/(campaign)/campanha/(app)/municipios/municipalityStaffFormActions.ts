'use server'

import {
  assignMunicipalityAdvisors,
  setMunicipalityExpectedVotes,
  setMunicipalityPoliticalTrend,
} from '@/app/(campaign)/campanha/actions/municipality'
import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  nullableFormText,
  optionalFormText,
  optionalMunicipalitySlugFromForm,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
  voteEstimateScenarioFromForm,
} from '@/lib/formData'
import {
  MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
  parsePoliticalTrendStatusFormValue,
} from '@/lib/schemas/municipality'
import { parseMunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'

import { municipalityStaffEditSafeMessages } from './municipalityStaffEditMessages'

export const setMunicipalityExpectedVotesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const expectedVotes = voteEstimateScenarioFromForm(formData, 'expectedVotes')

      await setMunicipalityExpectedVotes({ municipality, expectedVotes })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: 'Votos estimados atualizados.' }
    },
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage:
      'Não foi possível salvar os votos estimados. Verifique seu acesso e tente novamente.',
  })

export const setMunicipalityPoliticalTrendFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const status = parsePoliticalTrendStatusFormValue(optionalFormText(formData, 'trendStatus'))

      await setMunicipalityPoliticalTrend({
        municipality,
        status,
        note: nullableFormText(formData, 'trendNote'),
      })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: 'Tendência política registrada.' }
    },
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage:
      'Não foi possível registrar a tendência. Verifique seu acesso e tente novamente.',
  })

export const assignMunicipalityAdvisorsFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const advisors = repeatedRelationshipFormValues(formData, 'advisors')

      await assignMunicipalityAdvisors({ municipality, advisors })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: 'Assessores atualizados.' }
    },
    safeMessages: [MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE],
    genericMessage:
      'Não foi possível atualizar os assessores. Verifique seu acesso e tente novamente.',
  })

export const createMunicipalityListSignalFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')

      await createMunicipalityUpdate({
        municipality,
        kind: 'sinal',
        body: optionalFormText(formData, 'body'),
        signalType: parseMunicipalitySignalType(optionalFormText(formData, 'signalType')),
      })
      revalidateMunicipalityListPaths({ slug: optionalMunicipalitySlugFromForm(formData) })
      return { message: 'Sinal registrado.' }
    },
    genericMessage: 'Não foi possível registrar o sinal. Verifique seu acesso e tente novamente.',
  })
