import type { VoteEstimateScenarioFields } from '@/lib/voteEstimate'

import { OPS_MIRROR_SCHEMA_VERSION } from './opsMirrorVersion'

export type OpsVoteEstimateScenarioFields = VoteEstimateScenarioFields

export type OpsMunicipality = {
  id: number
  name: string
  slug: string
  kind: 'municipio' | 'zona'
  city: string
  region: string
  ibgeCode: string
  zoneNumber?: number | null
  advisors?: number[] | null
  priority?: ('alta' | 'normal') | null
  engagementLevel?: ('n0' | 'n1' | 'n2' | 'n3' | 'n4') | null
  levelNote?: string | null
  levelChangedAt?: string | null
  expectedVotes?: OpsVoteEstimateScenarioFields | null
  politicalTrend?: {
    status?: ('favoravel' | 'neutra' | 'desfavoravel') | null
    note?: string | null
    recordedBy?: number | null
    recordedAt?: string | null
  } | null
  stateDeputies?: number[] | null
  lastUpdateAt?: string | null
  updatedAt: string
}

export type OpsLeadershipContact = {
  id: number
  name: string
  phone?: string | null
}

export type OpsLeadership = {
  id: number
  contact: OpsLeadershipContact
  municipalities: number[]
  organizations?: number[] | null
  stateDeputies?: number[] | null
  exclusive?: boolean | null
  supportStatus: 'engajado' | 'a_abordar' | 'em_disputa' | 'negativo'
  notes?: string | null
  updatedAt: string
}

/** Leader-facing pledge fields — never includes staff-only estimates. */
export type OpsVotePledgeLeaderView = {
  id: number
  leadership: number
  municipality: number
  declaredVotes: number
  declaredAt?: string | null
  declaredBy?: number | null
  updatedAt: string
}

export type OpsVotePledge = OpsVotePledgeLeaderView & {
  estimatedVotes?: OpsVoteEstimateScenarioFields | null
  estimateNote?: string | null
  estimatedBy?: number | null
  estimatedAt?: string | null
}

export type OpsActivity = {
  id: number
  title: string
  slug: string
  kind:
    | 'caminhada'
    | 'comicio'
    | 'carreata'
    | 'panfletagem'
    | 'porta_a_porta'
    | 'reuniao_apoio'
    | 'lancamento'
    | 'convencao'
    | 'ato'
    | 'entrevista'
    | 'producao_conteudo'
    | 'digital'
    | 'outro'
  status: 'rascunho' | 'planejado' | 'confirmado' | 'realizado' | 'cancelado'
  deputyPresent?: boolean | null
  startAt?: string | null
  endAt?: string | null
  municipality: number
  locality?: string | null
  organizations?: number[] | null
  advisors?: number[] | null
  leadership?: number | null
  taskTotal?: number | null
  taskDoneCount?: number | null
  updatedAt: string
}

export type OpsStateDeputy = {
  id: number
  name: string
  slug: string
  party?: string | null
  notes?: string | null
  updatedAt: string
}

export type OpsOrganization = {
  id: number
  name: string
  slug: string
  kind: 'sindicato' | 'associacao' | 'religioso' | 'movimento' | 'categoria_profissional' | 'outro'
  municipalities?: number[] | null
  notes?: string | null
  updatedAt: string
}

export type OpsDemand = {
  id: number
  title: string
  slug: string
  kind:
    | 'material'
    | 'servico'
    | 'transporte'
    | 'alimentacao'
    | 'infraestrutura'
    | 'espaco'
    | 'equipamento'
    | 'pessoal_apoio'
    | 'outro'
  municipality: number
  activity?: number | null
  leadership?: number | null
  status: 'aberta' | 'em_analise' | 'escalada' | 'aprovada' | 'rejeitada'
  updatedAt: string
}

export type OpsMunicipalityUpdate = {
  id: number
  municipality: number
  author: number
  kind: 'semanal' | 'urgente' | 'nota' | 'sinal'
  body?: string | null
  signalType?:
    | ('invasao' | 'esfriamento' | 'visita_adversario' | 'proposta_broker' | 'outro')
    | null
  updatedAt: string
  createdAt: string
}

export type OpsGoals = {
  stateGoal: number
  margin?: number | null
  baseYear?: number | null
  note?: string | null
  updatedAt?: string | null
}

export type OpsSnapshot = {
  revisedAt: string
  schemaVersion: number
  municipalities: OpsMunicipality[]
  leaderships: OpsLeadership[]
  votePledges: OpsVotePledge[]
  activities: OpsActivity[]
  stateDeputies: OpsStateDeputy[]
  organizations: OpsOrganization[]
  demands: OpsDemand[]
  municipalityUpdates: OpsMunicipalityUpdate[]
  goals: OpsGoals | null
}

export const OPS_COLLECTION_KEYS = [
  'municipalities',
  'leaderships',
  'votePledges',
  'activities',
  'stateDeputies',
  'organizations',
  'demands',
  'municipalityUpdates',
] as const

export type OpsCollectionKey = (typeof OPS_COLLECTION_KEYS)[number]

export type OpsOutboxKey = `${OpsCollectionKey}:${number}`

export const opsOutboxKey = (collection: OpsCollectionKey, id: number): OpsOutboxKey =>
  `${collection}:${id}`

export const createEmptyOpsSnapshot = (revisedAt: string): OpsSnapshot => ({
  revisedAt,
  schemaVersion: OPS_MIRROR_SCHEMA_VERSION,
  municipalities: [],
  leaderships: [],
  votePledges: [],
  activities: [],
  stateDeputies: [],
  organizations: [],
  demands: [],
  municipalityUpdates: [],
  goals: null,
})

export const serializeOpsSnapshot = (snapshot: OpsSnapshot): string => JSON.stringify(snapshot)

export const parseOpsSnapshot = (raw: string): OpsSnapshot => JSON.parse(raw) as OpsSnapshot
