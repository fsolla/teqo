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

const WIZARD_VOTES_NEXT_FLOW_PLACEHOLDER =
  'Próximo passo deste fluxo (sinal, tendência ou resumo) em breve.' as const

export const WIZARD_VOTES_FINAL_CTA_LABEL = 'Salvar estimativas →' as const

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

export const WIZARD_LEADERSHIP_GRID_TITLE = 'Quem coordena por aqui?' as const

export const WIZARD_LEADERSHIP_FORM_CREATE_TITLE = 'Nova liderança' as const

export const WIZARD_LEADERSHIP_FORM_EDIT_TITLE = 'Atualizar liderança' as const

export const WIZARD_LEADERSHIP_SKIP_LABEL = 'Pular atualização de liderança →' as const

export const WIZARD_LEADERSHIP_CONTINUE_LABEL = 'Continuar' as const

export const WIZARD_LEADERSHIP_ADD_TILE_LABEL = 'Adicionar liderança' as const

export const WIZARD_LEADERSHIP_EMPTY_NOTES = 'Sem observação.' as const

export const WIZARD_LEADERSHIP_EMPTY_GRID =
  'Nenhuma liderança cadastrada neste município ainda.' as const

export const WIZARD_LEADERSHIP_SAVED_TOAST = 'Liderança salva.' as const
