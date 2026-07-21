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
