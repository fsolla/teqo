/**
 * Career literals for the C186 dossiê/boletim (single owner). The timeline is
 * loaded verbatim from the intention plan; uncertain periods stay marked, never
 * invented. Both the dossiê and the boletim read from here so the two outputs
 * cannot drift.
 */

export const SOLLA_DEPUTY_ID = 178857
export const SOLLA_BIRTH_DATE = '1961-04-11'
export const SOLLA_BIRTH_PLACE = 'Salvador-BA'
export const SOLLA_OFFICIAL_SITE = 'https://www.camara.leg.br/deputados/178857'

/** Career eras fixed by the product plan (A/B/C). */
export const DOSSIER_ERAS = [
  {
    id: 'A',
    label: 'Era A · Carreira técnica e gestão até 2006',
    period: '1985–2006',
    subtitle: 'Epidemiologia, gestão municipal e Ministério da Saúde',
  },
  {
    id: 'B',
    label: 'Era B · Secretaria Estadual de Saúde da Bahia',
    period: '2007–2014',
    subtitle: 'SESAB — governo Jaques Wagner',
  },
  {
    id: 'C',
    label: 'Era C · Deputado Federal',
    period: '2015–2027',
    subtitle: '55ª, 56ª e 57ª legislaturas',
  },
]

export const DOSSIER_ERA_IDS = DOSSIER_ERAS.map((era) => era.id)

/**
 * Career timeline, verbatim from the intention plan. `uncertain` carries the
 * source disagreement instead of picking a side; `era` binds the row to a
 * dossiê section.
 */
export const CAREER_TIMELINE = [
  {
    period: '1985–1987',
    role: 'Residência em Medicina Social (UFBA/INAMPS)',
    recovery: 'Biografia Câmara',
    era: 'A',
  },
  {
    period: '1989/90–1998',
    role: 'SESAB — epidemiologista (Itapagipe) e sanitarista (PACS/PSF/DEPAS)',
    recovery: 'Pronunciamento 03/01/2007 (saude.ba.gov.br) + biografia Câmara',
    era: 'A',
    uncertain: 'Período inicial incerto: 1989 vs 1990',
  },
  {
    period: '1995–1999',
    role: 'Consultor do Ministério da Saúde (Brasília)',
    recovery: 'Biografia Câmara',
    era: 'A',
  },
  {
    period: '1998',
    role: 'Professor (Escola Bahiana de Medicina) e pesquisador ISC/UFBA',
    recovery: 'Biografia Câmara / PT-BA',
    era: 'A',
  },
  {
    period: '1999–2002',
    role: 'Secretário Municipal de Saúde de Vitória da Conquista',
    recovery: 'Biografia Câmara (oficial), PT-BA',
    era: 'A',
  },
  {
    period: '2003–2005',
    role: 'Secretário de Atenção à Saúde do Ministério da Saúde',
    recovery: 'Biografia Câmara + discurso de 2007',
    era: 'A',
    uncertain: 'Término incerto: 2005 vs 2006 — fonte oficial Câmara indica 2005',
  },
  {
    period: '2006–2009',
    role: 'Doutorado em Clínica Médica (UFRJ)',
    recovery: 'Biografia Câmara',
    era: 'A',
  },
  {
    period: '01/01/2007–18/01/2014',
    role: 'Secretário Estadual de Saúde da Bahia (SESAB)',
    recovery: 'Wikipedia com refs + notícias SESAB',
    era: 'B',
  },
  {
    period: '2015–2019',
    role: 'Deputado Federal, 55ª legislatura (125.159 votos)',
    recovery: 'API Câmara /deputados/178857',
    era: 'C',
  },
  {
    period: '2019–2023',
    role: 'Deputado Federal, 56ª legislatura (135.657 votos)',
    recovery: 'API Câmara /deputados/178857',
    era: 'C',
  },
  {
    period: '2023–2027',
    role: 'Deputado Federal, 57ª legislatura (128.968 votos)',
    recovery: 'API Câmara /deputados/178857',
    era: 'C',
  },
]

/** Condensed 4-step trajectory for the one-page boletim. */
export const BULLETIN_TIMELINE_STEPS = [
  { period: '1999–2002', text: 'Saúde municipal em Vitória da Conquista' },
  { period: '2003–2005', text: 'Atenção à saúde no Ministério da Saúde' },
  { period: '2007–2014', text: 'Secretaria da Saúde da Bahia' },
  { period: 'DESDE 2015', text: 'Atuação na Câmara Federal' },
]

/**
 * The six cells the hi-fi page-1 "trajetória" grid shows; the complete timeline
 * (with every period and recovery trail) lives on the dedicated página de
 * trajetória — the page-1 grid must stay a one-glance read.
 */
const CAREER_HIGHLIGHT_PERIODS = [
  '1999–2002',
  '2003–2005',
  '01/01/2007–18/01/2014',
  '2015–2019',
  '2019–2023',
  '2023–2027',
]

export const careerTimelineHighlights = () =>
  CAREER_TIMELINE.filter((row) => CAREER_HIGHLIGHT_PERIODS.includes(row.period))

/**
 * Non-negotiable career facts the renderers may print without a per-item source
 * (they are the identity of the document). Anything beyond this needs a source.
 */
export const CAREER_NOTES = [
  'Nascido em 11/04/1961 (Salvador-BA) — não 1962.',
  'Nunca foi deputado estadual.',
  'Comenda Dois de Julho (ALBA, 2013).',
  'Cidadão Ilheense e Santamarense.',
]

/** Cover-page scope line (design 01 Capa). */
export const DOSSIER_SCOPE =
  'Escopo: carreira técnica e gestão pública até 2006 · SESAB 2007–2014 · Câmara dos Deputados 2015–2027. Afirmações sem fonte não entram como entrega.'
