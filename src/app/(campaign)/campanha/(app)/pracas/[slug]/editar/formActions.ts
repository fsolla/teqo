'use server'

import {
  assignPlazaAdvisors,
  setPlazaExpectedVotes,
  setPlazaPoliticalTrend,
  updatePlazaStrategy,
} from '@/app/(campaign)/campanha/actions/plaza'
import {
  nullableFormText,
  optionalFormText,
  optionalIntegerFormValue,
  optionalPlazaSlugFromForm,
  repeatedFormTexts,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/plaza'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { revalidatePlazaListPaths } from '@/utilities/plazaRevalidation'

export const updatePlazaStrategyFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const priority = optionalFormText(formData, 'priority')

    await updatePlazaStrategy({
      plaza,
      priority: priority === 'alta' ? 'alta' : 'normal',
      voteGoals: {
        good: optionalIntegerFormValue(formData, 'goalGood') ?? null,
        regular: optionalIntegerFormValue(formData, 'goalRegular') ?? null,
        minimum: optionalIntegerFormValue(formData, 'goalMinimum') ?? null,
      },
      strengths: repeatedFormTexts(formData, 'strengths'),
      risks: repeatedFormTexts(formData, 'risks'),
      dobradinhaNotes: nullableFormText(formData, 'dobradinhaNotes'),
      nextSteps: nullableFormText(formData, 'nextSteps'),
    })
    revalidatePlazaListPaths({ slug: optionalPlazaSlugFromForm(formData) })
    return { status: 'success', message: 'Estratégia atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'As metas devem seguir a ordem Bom ≥ Regular ≥ Mínimo quando informadas.',
        'Somente a coordenação e a assessoria podem editar a Praça.',
      ],
      genericMessage:
        'Não foi possível salvar a estratégia. Verifique seu acesso e tente novamente.',
    })
  }
}

export const setPlazaExpectedVotesFormAction = async (
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

export const setPlazaPoliticalTrendFormAction = async (
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

export const assignPlazaAdvisorsFormAction = async (
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
