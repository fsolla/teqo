import type { SpeechTopic } from '@/lib/speechFacets'

/**
 * Institution catalog for the `dossie-solla-instituicao` skill (C187). The
 * dossiê's institutional recorte is resolved here, fail-closed: a token that is
 * neither a known slug nor a known name/alias never becomes a slug. Mirrors the
 * `municipalityCatalog` precedent (static TS source of truth, no DB).
 *
 * The `topics` field is the bridge to the internal acervo: `speech` documents
 * have no institution relationship, so the institutional recorte is
 * theme→institution. Keep the list conservative — a loose theme would drag
 * unrelated speeches into the dossiê.
 */

export const INSTITUTION_KINDS = [
  'universidade',
  'instituto_federal',
  'empresa_publica',
  'autarquia',
  'orgao_publico',
  'conselho_classe',
  'entidade_classe',
  'categoria_profissional',
  'movimento',
  'rede',
  'outro',
] as const
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number]

export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  universidade: 'Universidade',
  instituto_federal: 'Instituto Federal',
  empresa_publica: 'Empresa pública',
  autarquia: 'Autarquia',
  orgao_publico: 'Órgão público',
  conselho_classe: 'Conselho de classe',
  entidade_classe: 'Entidade de classe',
  categoria_profissional: 'Categoria profissional',
  movimento: 'Movimento',
  rede: 'Rede',
  outro: 'Outro',
}

export const INSTITUTION_SPHERES = [
  'federal',
  'estadual',
  'municipal',
  'nao_governamental',
] as const
export type InstitutionSphere = (typeof INSTITUTION_SPHERES)[number]

export const INSTITUTION_SPHERE_LABELS: Record<InstitutionSphere, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
  municipal: 'Municipal',
  nao_governamental: 'Não governamental',
}

export const INSTITUTION_SCOPES = ['nacional', 'BA'] as const
export type InstitutionScope = (typeof INSTITUTION_SCOPES)[number]

export const INSTITUTION_SCOPE_LABELS: Record<InstitutionScope, string> = {
  nacional: 'Abrangência nacional',
  BA: 'Abrangência BA',
}

export interface InstitutionCatalogEntry {
  slug: string
  name: string
  aliases: readonly string[]
  kind: InstitutionKind
  sphere: InstitutionSphere
  scope: InstitutionScope
  topics: readonly SpeechTopic[]
}

/**
 * Minimal v1 seed (intention plan §Dados da decisão). Adding an institution is
 * a data edit here — the escape hatch `--slug=<x> --name="<Nome>"` covers a
 * one-off without inventing a catalog entry.
 */
export const institutionCatalog: readonly InstitutionCatalogEntry[] = [
  {
    slug: 'ufba',
    name: 'UFBA',
    aliases: ['Universidade Federal da Bahia'],
    kind: 'universidade',
    sphere: 'federal',
    scope: 'BA',
    topics: ['educacao', 'ciencia-tecnologia', 'saude'],
  },
  {
    slug: 'correios',
    name: 'Correios',
    aliases: ['ECT', 'Empresa Brasileira de Correios e Telégrafos'],
    kind: 'empresa_publica',
    sphere: 'federal',
    scope: 'nacional',
    topics: ['economia-trabalho', 'infraestrutura'],
  },
  {
    slug: 'enfermagem',
    name: 'Enfermagem',
    aliases: ['ABEn', 'ABEn-BA', 'COFEN', 'Coren-BA'],
    kind: 'categoria_profissional',
    sphere: 'federal',
    scope: 'nacional',
    topics: ['saude'],
  },
]

const catalogBySlug = new Map(institutionCatalog.map((entry) => [entry.slug, entry]))

export const getInstitutionCatalogEntry = (slug: string): InstitutionCatalogEntry | undefined =>
  catalogBySlug.get(slug)

export const isInstitutionSlug = (value: string): boolean => catalogBySlug.has(value)

export const institutionSlugs = (): readonly string[] =>
  institutionCatalog.map((entry) => entry.slug)

/** Every spelling declared for an entry (canonical name + aliases). */
export const institutionSpellings = (entry: InstitutionCatalogEntry): readonly string[] => [
  entry.name,
  ...entry.aliases,
]
