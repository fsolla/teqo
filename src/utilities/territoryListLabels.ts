import { campaignConceptOneLiner } from '@/lib/campaignIntelligenceConcepts'
import type { TerritoryListSortKey } from '@/utilities/territoryListUrl'

/** B22 — header tooltips for `/campanha/territorios` (E12 columns included). */
export const territoryColumnDescriptions: Partial<Record<TerritoryListSortKey, string>> = {
  region: 'Território de Identidade da Bahia — unidade de coordenação regional.',
  municipalities: 'Quantidade de municípios (ou zonas de Salvador) no território.',
  votes2022: 'Soma dos votos do Jorge Solla para deputado federal em 2022 no território.',
  pct: 'Quanto da votação própria do candidato na Bahia em 2022 veio deste território.',
  validVotes2022:
    'Soma dos votos válidos de deputado federal em 2022 nos municípios do território.',
  estimate2026:
    'Soma das estimativas de votos da mesa (cenário média) nos municípios do território.',
  coverage: 'Quantos municípios têm pelo menos um assessor atribuído.',
  cobertura: `${campaignConceptOneLiner('cobertura-da-meta')} Soma metas e compromissos dos municípios do território (cenário média).`,
  captura: `${campaignConceptOneLiner('captura')} No território, usa a soma dos votos próprios ÷ soma dos tetos — nunca a média das capturas por município. Passe o mouse na célula para mediana, amplitude e município crítico.`,
  classe:
    'Classe do território lida como um só (soma dos insumos de 2022), não a média das classes dos municípios.',
}
