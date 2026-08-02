import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignWizardActionIdForSlug,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import { wizardFlowTitleForActionId } from '@/lib/campaignHomeActions'
import { resolveWizardChainEntry, wizardChainContinueHref } from '@/lib/wizardActionChain'

export const WIZARD_MUNICIPALITY_STEP_TITLE = 'Em qual município?' as const

export const WIZARD_DISMISS_ARIA_LABEL = 'Sair da ação' as const

export const WIZARD_STEP_PENDING_MESSAGE = 'Carregando passo…' as const

export const WIZARD_APP_TOP_BAR_ARIA_LABEL = 'Campanha Jorge Solla' as const

export const CAMPAIGN_HOME_TOP_BAR_LINK_ARIA_LABEL = 'Ir para o início' as const

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

export const WIZARD_CHAIN_SKIP_LABEL = 'Pular' as const

export const WIZARD_VOTES_FINAL_CTA_LABEL = 'Salvar estimativas →' as const

const WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER = 'Próximo passo deste fluxo em breve.' as const

export type WizardVotesSkipAction = {
  label: string
  href: string
}

const shouldShowWizardVotesSkip = (entryAction: CampaignWizardActionId | undefined): boolean =>
  entryAction != null && entryAction !== 'update-votes'

export const resolveWizardVotesSkip = (
  entryAction: CampaignWizardActionId | undefined,
  municipalitySlug: string,
  returnPath?: string,
): WizardVotesSkipAction | undefined =>
  shouldShowWizardVotesSkip(entryAction)
    ? {
        label: WIZARD_CHAIN_SKIP_LABEL,
        href: wizardChainContinueHref(
          resolveWizardChainEntry(entryAction, 'update-votes'),
          'update-votes',
          municipalitySlug,
          returnPath,
        ),
      }
    : undefined

export const wizardNextStepTitle = (actionSlug: string): string => {
  if (actionSlug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    return 'Ajustar votos estimados'
  }
  return 'Continuar'
}

export const wizardNextStepPlaceholder = (_actionSlug: string): string =>
  WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER

export const WIZARD_LEADERSHIP_GRID_TITLE = 'Quem coordena por aqui?' as const

export const WIZARD_LEADERSHIP_FORM_CREATE_TITLE = 'Nova liderança' as const

export const WIZARD_LEADERSHIP_FORM_EDIT_TITLE = 'Atualizar liderança' as const

export const WIZARD_LEADERSHIP_CONTINUE_LABEL = 'Continuar' as const

export const WIZARD_LEADERSHIP_ADD_TILE_LABEL = 'Adicionar liderança' as const

export const WIZARD_LEADERSHIP_EMPTY_NOTES = 'Sem observação.' as const

export const WIZARD_LEADERSHIP_EMPTY_GRID =
  'Nenhuma liderança cadastrada neste município ainda.' as const

export const WIZARD_LEADERSHIP_SAVED_TOAST = 'Liderança salva.' as const

export const WIZARD_LEADERSHIP_STATUS_DRAWER_TITLE = 'Status de apoio' as const

export const WIZARD_LEADERSHIP_VOTES_DRAWER_TITLE = 'Votos declarados' as const

export const WIZARD_LEADERSHIP_DECLARE_VOTES_LABEL = 'Declarar votos' as const

export const WIZARD_LEADERSHIP_STATUS_SAVE_ERROR =
  'Não foi possível salvar o status. Tente novamente.' as const

export const WIZARD_LEADERSHIP_STATUS_PENDING = 'Salvando status de apoio.' as const

export const WIZARD_LEADERSHIP_VOTES_PENDING = 'Salvando declaração de votos.' as const

export const WIZARD_LEADERSHIP_VOTES_SAVED = 'Declaração registrada.' as const
