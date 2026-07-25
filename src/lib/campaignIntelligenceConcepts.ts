/**
 * E18 — curated documentation of the campaign-intelligence numbers the product
 * derives, rendered by `/campanha/conceitos` and linked from the tooltips that
 * expose each number.
 *
 * Content lives here, in code, next to the formulas it describes (E8:
 * `municipalityPotential.ts` / `goalCoverage.ts`) so a change to a formula and
 * the change to its explanation land in the same review — a Payload collection
 * would let the copy drift silently. Every entry must describe what the code
 * actually computes; when a formula changes, this text changes with it.
 *
 * v1 covers the E8 "conta da cadeira" numbers. Each later slice of the
 * intelligence program (E9 fila, E10 classificação relativa, B13 escala do
 * mapa, E11 sugestões, E12 TI, E13 giros, E14 níveis) appends its own entries
 * as part of its own delivery.
 */

export type CampaignConceptId =
  | 'votos-validos-projetados'
  | 'teto-do-campo'
  | 'captura'
  | 'share-intracampo'
  | 'roll-off'
  | 'meta'
  | 'cobertura-da-meta'

export type CampaignConceptCategoryId = 'base' | 'diagnostico' | 'meta'

export type CampaignIntelligenceConcept = {
  id: CampaignConceptId
  categoryID: CampaignConceptCategoryId
  title: string
  /** One sentence: what the number measures. */
  oneLiner: string
  /** How it is calculated, in plain text (never rendered as math notation). */
  formula: string
  /** Hand-written illustration; never computed from live data. */
  example?: string
  /** What decision the number supports — including when it supports none. */
  whyItMatters: string
  /** Where in `/campanha` the number is shown. */
  whereItAppears: string
}

export const CAMPAIGN_CONCEPT_CATEGORIES: ReadonlyArray<{
  id: CampaignConceptCategoryId
  label: string
}> = [
  { id: 'base', label: 'Base do cálculo' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'meta', label: 'Meta e cobertura' },
]

export const campaignIntelligenceConcepts: ReadonlyArray<CampaignIntelligenceConcept> = [
  {
    id: 'votos-validos-projetados',
    categoryID: 'base',
    title: 'Votos válidos projetados',
    oneLiner: 'Quantos votos válidos a disputa de deputado federal deve ter no município em 2026.',
    formula:
      'válidos projetados = (válidos 2014 + válidos 2018 + 2 × válidos 2022) ÷ 4, sobre o 1º turno de deputado federal.',
    example:
      'Um município com 20.000 válidos em 2014, 22.000 em 2018 e 24.000 em 2022 projeta (20.000 + 22.000 + 2 × 24.000) ÷ 4 = 22.500.',
    whyItMatters:
      'É a régua de tamanho do município: entra no teto do campo projetado e, por consequência, na meta sugerida. 2022 pesa o dobro por ser a eleição mais próxima. É uma fórmula fixa e auditável, não uma previsão estatística — o produto não faz modelo de votos.',
    whereItAppears:
      'Não aparece como número na tela; sustenta o teto do campo projetado e a meta sugerida.',
  },
  {
    id: 'teto-do-campo',
    categoryID: 'base',
    title: 'Teto do campo (projetado)',
    oneLiner:
      'Quantos votos o campo (PT e aliados de esquerda) pode alcançar no município em 2026.',
    formula:
      'teto 2022 = votos do presidencial do campo no município (1º turno de 2022). Teto projetado = teto 2022 × (válidos projetados ÷ válidos de 2022).',
    example:
      'Teto de 12.000 votos em 2022 num município que projeta crescer 5% de válidos vira um teto projetado de 12.600.',
    whyItMatters:
      'A disputa majoritária mostra o tamanho real do campo no município — muito maior do que a eleição fragmentada de deputado federal consegue revelar. É o denominador da captura e o peso usado para decompor a meta estadual. Usa só 2022: a majoritária de 2014 e 2018 já foi importada, mas ainda não entra nestas contas.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Teto do campo (proj.)").',
  },
  {
    id: 'captura',
    categoryID: 'diagnostico',
    title: 'Captura (2022)',
    oneLiner: 'Quanto do teto do campo o Jorge Solla efetivamente conquistou no município em 2022.',
    formula: 'captura = votos de Solla para deputado federal em 2022 ÷ teto do campo de 2022.',
    example: '1.200 votos de Solla sobre um teto de 12.000 = 10% de captura.',
    whyItMatters:
      'Separa "município pequeno" de "município onde o campo é grande e a campanha não chegou". Captura baixa com teto alto é espaço a ocupar; captura alta é base a defender. É só diagnóstico: não entra no cálculo da meta, para não premiar o que já está consolidado nem punir onde ainda não se trabalhou.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Captura (2022)").',
  },
  {
    id: 'share-intracampo',
    categoryID: 'diagnostico',
    title: 'Share intracampo',
    oneLiner:
      'Dos votos que o campo recebeu para deputado federal naquele ano, a fração que foi para Jorge Solla.',
    formula:
      'share intracampo = votos de Solla no ano ÷ votos de todos os partidos do campo para deputado federal no mesmo ano.',
    whyItMatters:
      'É a leitura do fogo amigo: o denominador é o próprio campo na mesma disputa, então o número mostra a divisão interna do voto de esquerda no município, ano a ano (2014, 2018, 2022). Diferente da captura, cujo denominador é o teto presidencial de 2022. O campo é uma lista curada de siglas por ano (2022 e 2026: PT, PC do B, PV), não a coligação registrada no TSE — coligações proporcionais juntam aliados sem afinidade só para somar quociente.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Share intracampo").',
  },
  {
    id: 'roll-off',
    categoryID: 'diagnostico',
    title: 'Roll-off (2022)',
    oneLiner:
      'Quanto voto em branco e nulo a disputa de deputado federal atraiu a mais que a presidencial, no mesmo comparecimento.',
    formula:
      'roll-off = (brancos + nulos de deputado federal em 2022) − (brancos + nulos do presidencial em 2022). O percentual mostra esse saldo sobre o comparecimento de deputado federal.',
    whyItMatters:
      'Mede quanto eleitor comparece, vota para presidente e desiste de escolher deputado. Roll-off alto indica eleitorado disponível para quem chegar com nome e razão para votar — mas é diagnóstico de contexto, não um reservatório de votos garantidos. Também usa só 2022.',
    whereItAppears: 'Card "Conta da cadeira", no detalhe do município ("Roll-off (2022)").',
  },
  {
    id: 'meta',
    categoryID: 'meta',
    title: 'Meta e meta sugerida',
    oneLiner: 'Quantos votos a campanha quer no município no cenário escolhido.',
    formula:
      'meta = estimativa da mesa para o cenário (pessimista, média ou otimista), quando existe; sem estimativa, usa a meta sugerida. Meta sugerida = meta estadual × (teto do campo projetado do município ÷ soma dos tetos projetados dos 435 municípios).',
    example:
      'Com meta estadual de 150.000 votos, um município que responde por 2% da soma dos tetos projetados recebe uma meta sugerida de 3.000.',
    whyItMatters:
      'A estimativa da mesa sempre vence a sugestão: quem conhece o município decide. A meta sugerida existe para que nenhum dos 435 municípios fique sem régua enquanto a mesa não preencher. A decomposição é proporcional só ao teto projetado — captura e share ficam de fora de propósito, como diagnóstico. A meta estadual (e a margem de segurança) é editada em Metas da campanha.',
    whereItAppears:
      'Card "Conta da cadeira" ("Meta usada na conta") e o campo de votos estimados no detalhe e na lista de municípios.',
  },
  {
    id: 'cobertura-da-meta',
    categoryID: 'meta',
    title: 'Cobertura da meta',
    oneLiner:
      'Quanto da meta já está coberto por compromissos de lideranças — não por expectativa da mesa.',
    formula:
      'cobertura = comprometido ÷ meta. Comprometido = soma dos votos das lideranças do município (estimativa do cenário quando existe, senão o número declarado pela liderança). Déficit = meta − comprometido.',
    example:
      'Meta de 3.000 com 1.200 votos comprometidos em lideranças = 40% de cobertura, déficit de 1.800.',
    whyItMatters:
      'É a diferença entre querer e ter: a expectativa da mesa define a meta, mas nunca conta como compromisso — se contasse, todo município com estimativa preenchida apareceria coberto sem uma única liderança por trás. O déficit descoberto é o que ordena onde a campanha precisa de mais rede.',
    whereItAppears:
      'Início (staff), visão geral e coluna "Cobertura da meta" na lista de municípios, e o card "Conta da cadeira" no detalhe.',
  },
]

export const campaignConceptsByCategory = (
  categoryID: CampaignConceptCategoryId,
): CampaignIntelligenceConcept[] =>
  campaignIntelligenceConcepts.filter((concept) => concept.categoryID === categoryID)

export const CAMPAIGN_CONCEPTS_PATH = '/campanha/conceitos'

/** Anchor href for a documented concept — typed so a renamed id can't leave a dead link behind. */
export const campaignConceptHref = (id: CampaignConceptId): string =>
  `${CAMPAIGN_CONCEPTS_PATH}#${id}`
