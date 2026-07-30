import { CAMPAIGN_WIZARD_ACTION_SLUGS } from '@/lib/campaignActionRoutes'

/** Shared copy for UX-1 wizard municipality step (B60). */
export const WIZARD_MUNICIPALITY_STEP_TITLE = 'Em qual município?' as const

export const WIZARD_MUNICIPALITY_SEARCH_LABEL = 'Buscar município' as const

export const WIZARD_MUNICIPALITY_SEARCH_PLACEHOLDER = 'Nome do município…' as const

export const WIZARD_MUNICIPALITY_SEARCH_EMPTY = 'Nenhum município encontrado.' as const

/** Placeholder until B61 ships vote adjustment. */
const WIZARD_NEXT_STEP_VOTES_PLACEHOLDER =
  'Próximo passo: ajuste de votos estimados neste município.' as const

const WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER = 'Próximo passo deste fluxo em breve.' as const

export const wizardNextStepTitle = (actionSlug: string): string => {
  if (actionSlug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    return 'Ajustar votos estimados'
  }
  return 'Continuar'
}

export const wizardNextStepPlaceholder = (actionSlug: string): string => {
  if (actionSlug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    return WIZARD_NEXT_STEP_VOTES_PLACEHOLDER
  }
  return WIZARD_NEXT_STEP_GENERIC_PLACEHOLDER
}
