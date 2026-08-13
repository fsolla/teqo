/**
 * Contacts list URL contract (C139): state, param parse/canonicalize,
 * source-level Payload `where` and hrefs. Own module, same shape as
 * `peopleListUrl` / `leadershipListUrl`.
 *
 * The `where` only covers what a single `contact` query can express (`q`).
 * Every other filter (gênero/estado/cidade/ausência/vínculo) is applied in
 * memory over the scoped rows (`contactListData.ts`) — reverse relations and
 * absence predicates have no SQL shape here.
 */
import type { Where } from 'payload'

import { CitiesByState } from '@/lib/cities'
import { leadershipGenders } from '@/lib/schemas/leadership'
import {
  allParamValues,
  buildListHref,
  createSortToggleHref,
  firstValue,
  normalizedText,
  resolveListUrl,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

export const contactPageSize = 25

export type ContactGender = (typeof leadershipGenders)[number]

export type ContactStateKey = keyof typeof CitiesByState

/** Labels mirroring the Contact collection options (Fase 3: 'outro' → 'Não binário'). */
export const contactGenderLabels: Record<ContactGender, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Não binário',
  nao_informado: 'Não informado',
}

export const CONTACT_ABSENCES = ['sem_telefone', 'sem_email'] as const
export type ContactAbsence = (typeof CONTACT_ABSENCES)[number]

export const contactAbsenceLabels: Record<ContactAbsence, string> = {
  sem_telefone: 'Sem telefone',
  sem_email: 'Sem e-mail',
}

export const CONTACT_VINCULOS = ['liderancas', 'dobradinhas', 'assessores', 'equipe'] as const
export type ContactVinculo = (typeof CONTACT_VINCULOS)[number]

export const contactVinculoLabels: Record<ContactVinculo, string> = {
  liderancas: 'Lideranças',
  dobradinhas: 'Dobradinhas',
  assessores: 'Assessores',
  equipe: 'Equipe',
}

export type ContactListSortKey = 'name' | 'cidade' | 'estado' | 'email'

export type ContactListSortDirection = 'asc' | 'desc'

export const contactListSortLabels: Record<ContactListSortKey, string> = {
  name: 'Nome',
  cidade: 'Cidade',
  estado: 'Estado',
  email: 'E-mail',
}

export type ContactListState = {
  page: number
  q?: string
  genders?: ContactGender[]
  states?: ContactStateKey[]
  cities?: string[]
  ausencias?: ContactAbsence[]
  vinculos?: ContactVinculo[]
  sort?: ContactListSortKey
  dir?: ContactListSortDirection
}

export type ContactListSearchParams = RawSearchParams

const contactListParamNames = [
  'q',
  'gender',
  'state',
  'city',
  'ausencia',
  'vinculo',
  'sort',
  'dir',
  'page',
] as const
const contactListParamNameSet = new Set<string>(contactListParamNames)

const contactGenderSet = new Set<string>(leadershipGenders)
const contactStateSet = new Set<string>(Object.keys(CitiesByState))
const contactAbsenceSet = new Set<string>(CONTACT_ABSENCES)
const contactVinculoSet = new Set<string>(CONTACT_VINCULOS)
const contactListSortKeySet = new Set<string>(Object.keys(contactListSortLabels))
const contactListSortDirSet = new Set<ContactListSortDirection>(['asc', 'desc'])

export const defaultContactListSortDir = (_key: ContactListSortKey): ContactListSortDirection =>
  'asc'

export const resolveContactListSort = (
  state: ContactListState,
): { sort: ContactListSortKey; dir: ContactListSortDirection } => {
  const sort = state.sort ?? 'name'
  return { sort, dir: state.dir ?? defaultContactListSortDir(sort) }
}

export const isDefaultContactListSort = (state: ContactListState): boolean => {
  const { sort, dir } = resolveContactListSort(state)
  return sort === 'name' && dir === defaultContactListSortDir('name')
}

/**
 * C139 — absence and vínculo facets do NOT use `parseExhaustiveEnumParam`:
 * selecting every member is NOT the same filter as selecting none (the
 * absence "Sem telefone"+"Sem e-mail" still excludes complete fichas; the
 * vínculo "any of them" still excludes fichas without a link) — same
 * rational as the C125 umbrella.
 */
const parseContactAbsenceParam = (raw: string | string[] | undefined): ContactAbsence[] =>
  allParamValues(raw).filter((token): token is ContactAbsence => contactAbsenceSet.has(token))

const parseContactVinculoParam = (raw: string | string[] | undefined): ContactVinculo[] =>
  allParamValues(raw).filter((token): token is ContactVinculo => contactVinculoSet.has(token))

export const parseContactListParams = (params: ContactListSearchParams): ContactListState => {
  const rawPage = strictDecimalInteger(firstValue(params.page))
  const q = normalizedText(firstValue(params.q))
  const genders = allParamValues(params.gender).filter((token): token is ContactGender =>
    contactGenderSet.has(token),
  )
  const states = allParamValues(params.state).filter((token): token is ContactStateKey =>
    contactStateSet.has(token),
  )
  const cities = allParamValues(params.city).filter((token) => token.length <= 100)
  const ausencias = parseContactAbsenceParam(params.ausencia)
  const vinculos = parseContactVinculoParam(params.vinculo)
  const rawSort = firstValue(params.sort)
  const sort =
    rawSort && contactListSortKeySet.has(rawSort) ? (rawSort as ContactListSortKey) : undefined
  const rawDir = firstValue(params.dir)
  const dir =
    rawDir && contactListSortDirSet.has(rawDir as ContactListSortDirection)
      ? (rawDir as ContactListSortDirection)
      : undefined

  return {
    page: rawPage ?? 1,
    ...(q ? { q } : {}),
    ...(genders.length ? { genders } : {}),
    ...(states.length ? { states } : {}),
    ...(cities.length ? { cities } : {}),
    ...(ausencias.length ? { ausencias } : {}),
    ...(vinculos.length ? { vinculos } : {}),
    ...(sort ? { sort } : {}),
    ...(dir ? { dir } : {}),
  }
}

export const contactListStateToRawParams = (
  state: ContactListState,
  page = state.page,
): ContactListSearchParams => ({
  page: String(page),
  q: state.q,
  gender: state.genders,
  state: state.states,
  city: state.cities,
  ausencia: state.ausencias,
  vinculo: state.vinculos,
  sort: state.sort,
  dir: state.dir,
})

/** Expects already-canonical state (from parse or a rule-preserving toggle). */
export const serializeCanonicalContactListSearchParams = (
  canonicalState: ContactListState,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (canonicalState.q) params.set('q', canonicalState.q)
  for (const gender of canonicalState.genders ?? []) params.append('gender', gender)
  for (const state of canonicalState.states ?? []) params.append('state', state)
  for (const city of canonicalState.cities ?? []) params.append('city', city)
  for (const ausencia of canonicalState.ausencias ?? []) params.append('ausencia', ausencia)
  for (const vinculo of canonicalState.vinculos ?? []) params.append('vinculo', vinculo)
  if (!isDefaultContactListSort(canonicalState)) {
    const { sort, dir } = resolveContactListSort(canonicalState)
    params.set('sort', sort)
    if (dir !== defaultContactListSortDir(sort)) params.set('dir', dir)
  }
  if (canonicalState.page > 1) params.set('page', String(canonicalState.page))
  return params
}

const buildContactListSearchParams = (
  state: ContactListState,
  page = state.page,
): URLSearchParams =>
  serializeCanonicalContactListSearchParams(
    parseContactListParams(contactListStateToRawParams(state, page)),
  )

export const buildContactListHref = (state: ContactListState, page: number): string =>
  buildListHref(state, buildContactListSearchParams, '/campanha/contatos', page)

export const buildContactSortHref = createSortToggleHref<ContactListState, ContactListSortKey>({
  resolveCurrentSort: resolveContactListSort,
  defaultDir: defaultContactListSortDir,
  buildHref: (state) => buildContactListHref(state, 1),
})

const contactSortOptionLabel = (key: ContactListSortKey, dir: ContactListSortDirection): string =>
  `${contactListSortLabels[key]} (${dir === 'asc' ? 'A–Z' : 'Z–A'})`

export const contactListSortOptions = (
  Object.keys(contactListSortLabels) as ContactListSortKey[]
).flatMap((key) =>
  (['asc', 'desc'] as const).map((dir) => ({ key, dir, label: contactSortOptionLabel(key, dir) })),
)

/** One option per key, in the key's default direction (omnibox cap precedent, C125). */
export const contactListSortPrimaryOptions = contactListSortOptions.filter(
  ({ key, dir }) => dir === defaultContactListSortDir(key),
)

export const resolveContactListUrl = (
  params: ContactListSearchParams,
  totalPages?: number,
): {
  state: ContactListState
  href: string
  redirectHref?: string
} =>
  resolveListUrl({
    params,
    paramNameSet: contactListParamNameSet,
    parse: parseContactListParams,
    buildSearchParams: buildContactListSearchParams,
    basePath: '/campanha/contatos',
    totalPages,
  })

/**
 * Source-level `where`: `q` matches name, e-mail or ANY stored phone. The
 * `phones.value` array subfield and the `like` operator (ILIKE substring,
 * case-insensitive) were verified against the local Postgres DB during the
 * C139 tracer phase (2026-08-13).
 */
export const buildContactListWhere = (state: ContactListState): Where => {
  if (!state.q) return {}
  return {
    or: [
      { name: { like: state.q } },
      { email: { like: state.q } },
      { 'phones.value': { like: state.q } },
    ],
  }
}
