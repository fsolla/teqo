import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignWizardActionIdForSlug,
} from '@/lib/campaignActionRoutes'
import { wizardFlowTitleForActionId } from '@/lib/campaignHomeActions'

export const WIZARD_MUNICIPALITY_STEP_TITLE = 'Em qual município?' as const

export const WIZARD_DISMISS_ARIA_LABEL = 'Sair da ação' as const

export const WIZARD_APP_TOP_BAR_ARIA_LABEL = 'Campanha Jorge Solla' as const

export const wizardMunicipalityChromeAriaLabel = (municipalityLabel: string): string =>
  `Município em atualização: ${municipalityLabel}`

export const wizardFlowChromeAriaLabel = (flowTitle: string): string => `Ação: ${flowTitle}`

export const wizardFlowTitleForSlug = (actionSlug: string): string => {
  const actionId = campaignWizardActionIdForSlug(actionSlug)
  return actionId ? wizardFlowTitleForActionId(actionId) : 'Continuar'
}

export const WIZARD_MUNICIPALITY_SEARCH_LABEL = 'Buscar município' as const

export const WIZARD_MUNICIPALITY_SEARCH_PLACEHOLDER = 'Nome do município…' as const

export const WIZARD_MUNICIPALITY_SEARCH_EMPTY = 'Nenhum município encontrado.' as const

export const WIZARD_VOTES_SAVED_MESSAGE = 'Votos estimados atualizados.' as const

export const WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER =
  'Próximo passo deste fluxo (sinal, tendência ou resumo) em breve.' as const

export const WIZARD_VOTES_SAVE_ERROR_MESSAGE =
  'Não foi possível salvar os votos estimados. Tente novamente.' as const

export const WIZARD_VOTES_INVALID_DRAFT_MESSAGE =
  'Informe um número válido ou deixe em branco.' as const

export const wizardVoteReturnToScenarioLabel = (scenarioLabel: string): string =>
  `Voltar para ${scenarioLabel.toLowerCase()}`

const WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER = 'Próximo passo deste fluxo em breve.' as const

export const wizardNextStepTitle = (actionSlug: string): string => {
  if (actionSlug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    return 'Ajustar votos estimados'
  }
  return 'Continuar'
}

export const wizardNextStepPlaceholder = (actionSlug: string): string => {
  if (actionSlug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    return WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER
  }
  return WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER
}
