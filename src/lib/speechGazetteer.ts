import { municipalityCatalog, type MunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import {
  SPEECH_SCOPES,
  SPEECH_TOPICS,
  type SpeechFacetClassification,
  type SpeechScope,
  type SpeechTopic,
} from '@/lib/speechFacets'
import { normalizeForSearch } from '@/lib/speechSearch'

/**
 * Offline gazetteer pass of the speech facet classifier (C153): topic/scope
 * lexicons plus municipality mentions. Deliberately a separate module from the
 * `speechFacets` contract so the C154 client bundle can import the topic
 * labels without pulling the lexicon and the municipality catalog.
 */

/** Topic keyword lexicon — terms are compared against normalized text. */
const SPEECH_TOPIC_TERMS: Record<SpeechTopic, readonly string[]> = {
  saude: [
    'saude',
    'sus',
    'hospital',
    'posto de saude',
    'medicamento',
    'farmacia popular',
    'vacina',
    'vacinacao',
    'medico',
    'enfermagem',
    'atencao basica',
    'ministerio da saude',
    'agentes comunitarios',
  ],
  educacao: [
    'educacao',
    'escola',
    'professor',
    'professora',
    'estudante',
    'aluno',
    'universidade',
    'ensino',
    'alfabetizacao',
    'creche',
    'merenda',
    'pne',
    'ifba',
    'ufba',
    'enem',
  ],
  cultura: [
    'cultura',
    'cultural',
    'artista',
    'teatro',
    'cinema',
    'musica',
    'patrimonio',
    'lei rouanet',
    'carnaval',
    'museu',
    'livro',
    'leitura',
    'audiovisual',
  ],
  esporte: ['esporte', 'esportivo', 'futebol', 'atleta', 'olimpiada', 'campeonato'],
  'seguranca-publica': [
    'seguranca publica',
    'seguranca',
    'policia',
    'policial',
    'violencia',
    'crime',
    'criminalidade',
    'trafico',
    'armas',
    'milicia',
  ],
  'meio-ambiente': [
    'meio ambiente',
    'ambiental',
    'desmatamento',
    'garimpo',
    'queimada',
    'clima',
    'climatico',
    'sustentabilidade',
    'reciclagem',
    'poluicao',
    'floresta',
    'amazonia',
  ],
  'economia-trabalho': [
    'economia',
    'emprego',
    'desemprego',
    'trabalhador',
    'trabalhadora',
    'salario',
    'salario minimo',
    'renda',
    'industria',
    'comercio',
    'inflacao',
    'juros',
    'tributacao',
    'reforma tributaria',
  ],
  'direitos-humanos': [
    'direitos humanos',
    'assistencia social',
    'bolsa familia',
    'cras',
    'creas',
    'pobreza',
    'miseria',
    'desigualdade',
    'populacao de rua',
    'idoso',
    'seguridade',
  ],
  infraestrutura: [
    'infraestrutura',
    'transporte',
    'rodovia',
    'estrada',
    'saneamento',
    'mobilidade',
    'metro',
    'ferrovia',
    'porto',
    'aeroporto',
    'energia eletrica',
    'luz para todos',
    'pavimentacao',
  ],
  'ciencia-tecnologia': [
    'ciencia',
    'cientifico',
    'tecnologia',
    'pesquisa',
    'inovacao',
    'embrapa',
    'internet',
    'banda larga',
    'inteligencia artificial',
  ],
  'politica-instituicoes': [
    'politica',
    'politico',
    'governo',
    'congresso',
    'camara dos deputados',
    'senado',
    'eleicao',
    'eleitor',
    'democracia',
    'instituicoes',
    'constituicao',
    'impeachment',
    'mandato',
    'deputado',
    'deputada',
    'presidente da republica',
    'ministro',
    'golpe',
    'ditadura',
  ],
  agricultura: [
    'agricultura',
    'agropecuaria',
    'agricultor',
    'agricultora',
    'agricultura familiar',
    'pecuaria',
    'lavoura',
    'safra',
    'reforma agraria',
    'rural',
    'irrigacao',
    'seca',
    'semiarido',
  ],
  'habitacao-cidades': [
    'habitacao',
    'moradia',
    'minha casa minha vida',
    'cidade',
    'urbano',
    'urbana',
    'favela',
    'periferia',
    'regularizacao fundiaria',
    'aluguel',
  ],
  'comunicacao-midia': [
    'comunicacao',
    'midia',
    'imprensa',
    'jornal',
    'jornalismo',
    'radio',
    'televisao',
    'redes sociais',
    'fake news',
    'desinformacao',
  ],
  'igualdade-racial': [
    'igualdade racial',
    'racial',
    'racismo',
    'racista',
    'negro',
    'negra',
    'quilombola',
    'quilombo',
    'consciencia negra',
    'cotas',
  ],
  'mulheres-genero': [
    'mulher',
    'mulheres',
    'genero',
    'feminicidio',
    'violencia domestica',
    'violencia contra a mulher',
    'igualdade de genero',
    'maternidade',
    'machismo',
  ],
  juventude: [
    'juventude',
    'jovem',
    'jovens',
    'adolescente',
    'crianca',
    'primeira infancia',
    'juventude rural',
  ],
  'pessoa-deficiencia': [
    'pessoa com deficiencia',
    'deficiencia',
    'deficiente',
    'acessibilidade',
    'autismo',
    'autista',
    'cadeirante',
    'pcd',
    'libras',
  ],
}

const SPEECH_SCOPE_TERMS: Record<SpeechScope, readonly string[]> = {
  bahia: ['bahia', 'baiano', 'baiana', 'baianos', 'baianas'],
  brasil: [
    'brasil',
    'brasileiro',
    'brasileira',
    'brasileiros',
    'brasileiras',
    'nacional',
    'pais',
    'governo federal',
    'uniao',
    'republica',
  ],
  internacional: [
    'internacional',
    'mundo',
    'mundial',
    'exterior',
    'onu',
    'mercosul',
    'otan',
    'uniao europeia',
    'china',
    'estados unidos',
    'eua',
    'europa',
    'africa',
    'america latina',
    'guerra',
    'refugiados',
    'embaixada',
    'tratado',
  ],
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const containsTerm = (normalizedText: string, term: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`).test(normalizedText)

// ---------------------------------------------------------------------------
// Municipality mentions
// ---------------------------------------------------------------------------

/**
 * NFD-stripped, whitespace-collapsed but CASE-PRESERVING copy, index-aligned
 * with `normalizeForSearch` (lowercasing does not change length in pt-BR).
 * Used to reject lowercase common words that are also municipality names
 * ("saúde" the noun vs. Saúde (BA), "central" the adjective vs. Central).
 */
const stripToComparable = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

type MunicipalityMatcher = { normalized: string; entries: MunicipalityCatalogEntry[] }

let municipalityMatchers: readonly MunicipalityMatcher[] | null = null

const getMunicipalityMatchers = (): readonly MunicipalityMatcher[] => {
  if (municipalityMatchers) return municipalityMatchers
  const byCity = new Map<string, MunicipalityCatalogEntry[]>()
  for (const entry of municipalityCatalog) {
    const list = byCity.get(entry.city)
    if (list) list.push(entry)
    else byCity.set(entry.city, [entry])
  }
  municipalityMatchers = [...byCity.entries()]
    .map(([city, entries]) => ({ normalized: normalizeForSearch(city), entries }))
    .sort((left, right) => right.normalized.length - left.normalized.length)
  return municipalityMatchers
}

/**
 * Institutional phrases that contain a municipality name but are not a
 * mention of the place (Saúde (BA) inside "Sistema Único de Saúde", Central
 * (BA) inside "Banco Central", Planalto (BA) inside "Palácio do Planalto").
 * Masked (same length) before matching so the capitalization heuristic does
 * not turn them into false positives.
 */
const MUNICIPALITY_FALSE_POSITIVE_PHRASES: readonly string[] = [
  'sistema unico de saude',
  'ministerio da saude',
  'secretaria de saude',
  'secretaria municipal de saude',
  'conselho de saude',
  'conselho municipal de saude',
  'saude publica',
  'saude bucal',
  'atencao basica',
  'profissionais de saude',
  'plano de saude',
  'palacio do planalto',
  'planalto central',
  'banco central',
  'central unica',
  'central sindical',
  'central de',
]

const maskFalsePositivePhrases = (value: string): string => {
  let masked = value
  for (const phrase of MUNICIPALITY_FALSE_POSITIVE_PHRASES) {
    masked = masked.replace(new RegExp(escapeRegExp(phrase), 'gi'), (match) =>
      ' '.repeat(match.length),
    )
  }
  return masked
}

/**
 * Municipality names that are also common words, institutions or people
 * ("Saúde", "Central", "Palmeiras", "Planalto", "Santana", "Wagner", the
 * senator Jaques Wagner): a bare capitalized match is not enough, so they
 * require a place context. Curated — grows with observed false positives.
 */
const AMBIGUOUS_MUNICIPALITY_CITIES = new Set([
  'saude',
  'central',
  'gloria',
  'palmeiras',
  'planalto',
  'santana',
  'seabra',
  'urandi',
  'wanderley',
  'wagner',
  'juazeiro',
])

const PLACE_CONTEXT = /(?:^|[^a-z0-9])(?:em|para|cidade de|municipio de|distrito de) $/

/**
 * Matches catalog municipality names in the text. Longest names are consumed
 * first so "São Félix do Coribe" never also yields "Coribe"; a match must
 * start with an uppercase letter in the original text, so prose "saúde" does
 * not become the municipality Saúde. Salvador has no city row — a mention of
 * the city maps to its 19 zone entries (documented product decision).
 */
export const matchMunicipalityMentions = (text: string): MunicipalityCatalogEntry[] => {
  const comparable = maskFalsePositivePhrases(stripToComparable(String(text ?? '')))
  if (comparable === '') return []
  const masked = comparable.toLowerCase().split('')
  const matched: MunicipalityCatalogEntry[] = []
  const seen = new Set<string>()

  for (const matcher of getMunicipalityMatchers()) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(matcher.normalized)}($|[^a-z0-9])`, 'g')
    const haystack = masked.join('')
    let found = false
    let match: RegExpExecArray | null
    while ((match = pattern.exec(haystack)) !== null) {
      const start = match.index + match[1].length
      if (!/[A-Z]/.test(comparable[start] ?? '')) continue
      if (
        AMBIGUOUS_MUNICIPALITY_CITIES.has(matcher.normalized) &&
        !PLACE_CONTEXT.test(comparable.slice(0, start).toLowerCase())
      ) {
        continue
      }
      found = true
      for (let index = start; index < start + matcher.normalized.length; index += 1) {
        masked[index] = ' '
      }
    }
    if (!found) continue
    for (const entry of matcher.entries) {
      if (seen.has(entry.slug)) continue
      seen.add(entry.slug)
      matched.push(entry)
    }
  }

  return matched
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type SpeechFacetInput = {
  transcript: string
  summary?: string | null
  keywords?: readonly string[]
}

/**
 * Offline facet pass: topic lexicon + scope lexicon + municipality gazetteer.
 * People/programs/projects require the LLM pass; this pass never invents them.
 * Municipality mentions ignore the official keywords: they are a controlled
 * topic vocabulary ("Saúde" the theme) and produced false place matches.
 */
export const classifySpeechByGazetteer = (input: SpeechFacetInput): SpeechFacetClassification => {
  const keywordText = input.keywords?.join(' ') ?? ''
  const normalized = normalizeForSearch(
    [input.summary ?? '', keywordText, input.transcript].join(' '),
  )

  const topics = SPEECH_TOPICS.filter(({ value }) =>
    SPEECH_TOPIC_TERMS[value].some((term) => containsTerm(normalized, term)),
  ).map(({ value }) => value)

  const municipalities = matchMunicipalityMentions(
    [input.summary ?? '', input.transcript].join(' '),
  )
  const matchedScopes = new Set<SpeechScope>(
    SPEECH_SCOPES.filter(({ value }) =>
      SPEECH_SCOPE_TERMS[value].some((term) => containsTerm(normalized, term)),
    ).map(({ value }) => value),
  )
  if (municipalities.length > 0) matchedScopes.add('bahia')

  return {
    topics,
    scopes: SPEECH_SCOPES.filter(({ value }) => matchedScopes.has(value)).map(({ value }) => value),
    municipalities,
    people: [],
    programs: [],
    projects: [],
  }
}
