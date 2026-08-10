export const campaignDemandKinds = [
  'material',
  'servico',
  'transporte',
  'alimentacao',
  'infraestrutura',
  'espaco',
  'equipamento',
  'pessoal_apoio',
  'outro',
] as const

export type CampaignDemandKind = (typeof campaignDemandKinds)[number]

export const campaignDemandKindLabels: Record<CampaignDemandKind, string> = {
  material: 'Material',
  servico: 'Serviço',
  transporte: 'Transporte',
  alimentacao: 'Alimentação',
  infraestrutura: 'Infraestrutura',
  espaco: 'Espaço',
  equipamento: 'Equipamento',
  pessoal_apoio: 'Pessoal de apoio',
  outro: 'Outro',
}

/**
 * Shared demand-form copy (B195 single free-text field): used by the wizard
 * step and the `/demandas/nova` form so the two cadastros never diverge.
 */
export const CAMPAIGN_DEMAND_BODY_LABEL = 'O que você precisa?' as const
export const CAMPAIGN_DEMAND_BODY_DESCRIPTION =
  'Descreva o que você precisa, com o quê e os detalhes.' as const
export const CAMPAIGN_DEMAND_BODY_PLACEHOLDER =
  'Ex.: 500 santinhos para a feira de sábado; transporte para o comício; diária da equipe…' as const
export const CAMPAIGN_DEMAND_BODY_MAX_LENGTH = 4000 as const
export const CAMPAIGN_DEMAND_KIND_LABEL = 'Tipo' as const
export const CAMPAIGN_DEMAND_ACTIVITY_LABEL = 'Atividade relacionada' as const
export const CAMPAIGN_DEMAND_ACTIVITY_DESCRIPTION =
  'Opcional. Busque atividades do município selecionado.' as const
export const CAMPAIGN_DEMAND_ACTIVITY_EMPTY_LABEL = 'Nenhuma atividade' as const
export const CAMPAIGN_DEMAND_ACTIVITY_DIALOG_DESCRIPTION =
  'Busque atividades do município selecionado por título.' as const
export const CAMPAIGN_DEMAND_SUBMIT_LABEL = 'Abrir demanda' as const

export const campaignDemandStatuses = [
  'aberta',
  'em_analise',
  'escalada',
  'aprovada',
  'rejeitada',
] as const

export type CampaignDemandStatus = (typeof campaignDemandStatuses)[number]

export const campaignDemandStatusLabels: Record<CampaignDemandStatus, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  escalada: 'Escalada ao Coordenador Geral',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
}

/** Allowed workflow transitions (staff-driven; decisions on escalated demands are coordinator-only). */
export const campaignDemandTransitions: Record<CampaignDemandStatus, CampaignDemandStatus[]> = {
  aberta: ['em_analise', 'escalada', 'aprovada', 'rejeitada'],
  em_analise: ['escalada', 'aprovada', 'rejeitada'],
  escalada: ['aprovada', 'rejeitada'],
  aprovada: [],
  rejeitada: [],
}

export const campaignDemandTransitionLabels: Record<CampaignDemandStatus, string> = {
  aberta: 'Reabrir',
  em_analise: 'Iniciar análise',
  escalada: 'Escalar ao Coordenador Geral',
  aprovada: 'Aprovar',
  rejeitada: 'Rejeitar',
}

/**
 * Refusal messages matched by exact string in the routes' `safeMessages`
 * (`mapCampaignFormActionError`). Named once per the B32+/B37 contract: a
 * reworded literal at either end silently collapses the refusal into the
 * generic message — the conventions spec bans literals at both ends.
 */
export const CAMPAIGN_DEMAND_INVALID_STATUS_MESSAGE = 'Status de demanda inválido.'
export const CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE =
  'Somente a coordenação, a assessoria e o candidato movem demandas.'
export const CAMPAIGN_DEMAND_ESCALATED_DECISION_MESSAGE =
  'Demandas escaladas são decididas pelo Coordenador Geral ou Candidato.'
export const CAMPAIGN_DEMAND_COST_STAFF_MESSAGE =
  'Somente a coordenação, a assessoria e o candidato registram custos.'
export const CAMPAIGN_DEMAND_EDIT_STAFF_MESSAGE =
  'Somente a coordenação, a assessoria e o candidato editam demandas.'
export const CAMPAIGN_DEMAND_RECEIPT_STAFF_MESSAGE =
  'Somente a coordenação e a assessoria anexam comprovantes.'
export const CAMPAIGN_DEMAND_RECEIPT_TYPE_MESSAGE = 'Envie uma imagem (JPEG, PNG, WebP) ou PDF.'
export const CAMPAIGN_DEMAND_RECEIPT_EMPTY_MESSAGE = 'O arquivo enviado está vazio.'
export const CAMPAIGN_DEMAND_RECEIPT_SIZE_MESSAGE = 'O comprovante deve ter no máximo 10 MB.'

export const CAMPAIGN_DEMAND_TRANSITION_SAFE_MESSAGES = [
  CAMPAIGN_DEMAND_TRANSITION_STAFF_MESSAGE,
  CAMPAIGN_DEMAND_ESCALATED_DECISION_MESSAGE,
  CAMPAIGN_DEMAND_INVALID_STATUS_MESSAGE,
] as const

export const CAMPAIGN_DEMAND_RECEIPT_SAFE_MESSAGES = [
  CAMPAIGN_DEMAND_RECEIPT_TYPE_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_EMPTY_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_SIZE_MESSAGE,
  CAMPAIGN_DEMAND_RECEIPT_STAFF_MESSAGE,
] as const
