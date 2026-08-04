'use server'

import {
  assignMunicipalityAdvisors,
  setMunicipalityExpectedVotes,
  setMunicipalityPoliticalTrend,
} from '@/app/(campaign)/campanha/actions/municipality'
import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  createMunicipalityStateDeputy,
  setStateDeputyMunicipalitiesBatch,
  type MunicipalityStateDeputyCreateResult,
} from '@/app/(campaign)/campanha/actions/stateDeputy'
import {
  nullableFormText,
  optionalFormText,
  optionalMunicipalitySlugFromForm,
  repeatedRelationshipFormValues,
  requiredFormBoolean,
  requiredFormText,
  requiredRelationshipFormValue,
  voteEstimateScenarioFromForm,
} from '@/lib/formData'
import { WIZARD_TREND_SAVED_MESSAGE } from '@/lib/politicalTrendWizardUi'
import {
  MUNICIPALITY_ADVISOR_MEMBERSHIP_UNRESTRICTED_MESSAGE,
  MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
  parsePoliticalTrendStatusFormValue,
} from '@/lib/schemas/municipality'
import { parseMunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import {
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
  STATE_DEPUTY_NAME_REQUIRED_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
import { WIZARD_SIGNAL_SAVED_MESSAGE } from '@/lib/wizardSignalUi'
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
      return { message: WIZARD_TREND_SAVED_MESSAGE }
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
      return { message: WIZARD_SIGNAL_SAVED_MESSAGE }
    },
    genericMessage: 'Não foi possível registrar o sinal. Verifique seu acesso e tente novamente.',
  })

/**
 * B157 — one chip toggle in the "Dobradinhas" column of `/campanha/municipios`.
 * Deliberately NOT a new record: the B37 batch already owns the inverted write
 * (`stateDeputyId` + `municipalityIds[]`), so this wrapper maps the owner-shaped
 * delta of the cell (`municipalityId` + `stateDeputyId`) onto it — the lock,
 * the advisor-scope check, the cap and the revalidation all stay where B37 put
 * them (and `setStateDeputyMunicipalitiesBatch` already revalidates the list,
 * the touched detail and the deputy's ficha).
 */
export const setMunicipalityStateDeputiesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipalityId = requiredRelationshipFormValue(formData, 'municipalityId')
      const stateDeputyId = requiredRelationshipFormValue(formData, 'stateDeputyId')
      const assigned = requiredFormBoolean(formData, 'assigned')

      await setStateDeputyMunicipalitiesBatch({
        stateDeputyId,
        municipalityIds: [municipalityId],
        assigned,
      })
      return { message: assigned ? 'Dobradinha vinculada.' : 'Dobradinha removida.' }
    },
    safeMessages: STATE_DEPUTY_MUNICIPALITIES_SAFE_MESSAGES,
    genericMessage:
      'Não foi possível atualizar as dobradinhas. Verifique seu acesso e tente novamente.',
  })

/**
 * B157 — inline create from the "Dobradinhas" column: the raw search text
 * (`Nome (PARTIDO)` syntax) is parsed and persisted with the automatic link to
 * the município. The success state carries the created deputy so the cell can
 * swap its optimistic chip without waiting for the RSC refresh.
 */
export const createMunicipalityStateDeputyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<
  CampaignFormActionState & { stateDeputy?: MunicipalityStateDeputyCreateResult['stateDeputy'] }
> =>
  runCampaignFormAction({
    execute: async () => {
      const stateDeputy = await createMunicipalityStateDeputy({
        municipalityId: requiredRelationshipFormValue(formData, 'municipalityId'),
        rawName: requiredFormText(formData, 'rawName'),
      })
      return {
        message: 'Dobradinha criada e vinculada.',
        stateDeputy: stateDeputy.stateDeputy,
      }
    },
    safeMessages: [
      STATE_DEPUTY_CONFLICT_MESSAGE,
      STATE_DEPUTY_STAFF_MESSAGE,
      STATE_DEPUTY_NAME_REQUIRED_MESSAGE,
      MUNICIPALITY_STATE_DEPUTIES_CAP_MESSAGE,
    ],
    genericMessage: 'Não foi possível criar a dobradinha. Tente novamente.',
  })
