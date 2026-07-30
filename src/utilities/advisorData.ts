import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'

const advisorPageSize = 25
const advisorListBasePath = '/campanha/assessores'

export type AdvisorListState = {
  page: number
  q?: string
}

type AdvisorMunicipalityViewModel = {
  id: number
  name: string
  slug: string
}

type AdvisorAccountViewModel = {
  id: number
  name: string
  email: string | null
  phone: string | null
}

/**
 * Ids only: the list renders the portfolio as chips, which resolve their own
 * labels from the static catalog. Names here would ship a second copy of them.
 */
export type AdvisorRowViewModel = AdvisorAccountViewModel & {
  municipalityIDs: number[]
}

/** The detail page renders real names and links, so it keeps the labels. */
export type AdvisorDetailViewModel = AdvisorAccountViewModel & {
  municipalities: AdvisorMunicipalityViewModel[]
}

export const parseAdvisorListParams = (searchParams: RawSearchParams): AdvisorListState => {
  const q = normalizedText(firstValue(searchParams.q))
  const page = strictDecimalInteger(firstValue(searchParams.page)) ?? 1

  return {
    page,
    ...(q ? { q } : {}),
  }
}

const buildAdvisorListSearchParams = (state: AdvisorListState, page = state.page) => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

export const advisorListHrefForPage = (state: AdvisorListState, page: number): string =>
  buildListHref(state, buildAdvisorListSearchParams, advisorListBasePath, page)

/** Fan a município out to each of the advisors the caller asked about. */
const collectByAdvisor = <T>(
  advisors: readonly unknown[] | null | undefined,
  advisorIdSet: ReadonlySet<number>,
  byAdvisor: Map<number, T[]>,
  value: T,
) => {
  for (const advisor of advisors ?? []) {
    const id = relationshipId(advisor)
    if (id === null || !advisorIdSet.has(id)) continue
    const list = byAdvisor.get(id)
    if (list) list.push(value)
    else byAdvisor.set(id, [value])
  }
}

/**
 * Portfolio ids for the LIST, which renders chips that resolve their own labels
 * from the static catalog — sending names here would ship a second copy of them.
 *
 * Intentional admin bypass: advisor rows already resolved after the unrestricted
 * route gate.
 */
export const municipalityIdsByAdvisorIds = async (
  payload: Payload,
  advisorIDs: number[],
): Promise<Map<number, number[]>> => {
  const byAdvisor = new Map<number, number[]>()
  if (advisorIDs.length === 0) return byAdvisor

  const advisorIdSet = new Set(advisorIDs)
  const municipalities = await payload.find({
    collection: 'municipality',
    where: { advisors: { in: advisorIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { advisors: true },
    overrideAccess: true,
  })

  for (const municipality of municipalities.docs) {
    collectByAdvisor(municipality.advisors, advisorIdSet, byAdvisor, municipality.id)
  }

  return byAdvisor
}

/** Same portfolio with labels, for the DETAIL page, which renders real links. */
const municipalitiesByAdvisorIds = async (
  payload: Payload,
  advisorIDs: number[],
): Promise<Map<number, AdvisorMunicipalityViewModel[]>> => {
  const byAdvisor = new Map<number, AdvisorMunicipalityViewModel[]>()
  if (advisorIDs.length === 0) return byAdvisor

  const advisorIdSet = new Set(advisorIDs)
  // Intentional admin bypass — same rationale as the sibling above.
  const municipalities = await payload.find({
    collection: 'municipality',
    where: { advisors: { in: advisorIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, slug: true, advisors: true },
    overrideAccess: true,
  })

  for (const municipality of municipalities.docs) {
    collectByAdvisor(municipality.advisors, advisorIdSet, byAdvisor, {
      id: municipality.id,
      name: municipality.name,
      slug: municipality.slug,
    })
  }

  return byAdvisor
}

/**
 * Lists advisor accounts for the unrestricted management UI.
 *
 * Intentional admin bypass (no `user`): `email`/`username` are stripped by
 * `removePrivateAuthFields` and gated by self-only field access — the page
 * gate already asserted `isCampaignUnrestricted`, and the job is to surface
 * placeholder `@planilha.invalid` emails so staff can activate accounts.
 */
export const loadAdvisorListPageData = async (
  payload: Payload,
  state: AdvisorListState,
): Promise<{ rows: AdvisorRowViewModel[]; totalDocs: number; totalPages: number }> => {
  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [
        { role: { equals: 'advisor' } },
        ...(state.q
          ? [
              {
                or: [{ name: { contains: state.q } }, { email: { contains: state.q } }],
              },
            ]
          : []),
      ],
    },
    depth: 0,
    limit: advisorPageSize,
    page: state.page,
    sort: 'name',
    select: { name: true, email: true, phone: true, role: true },
    overrideAccess: true,
  })

  const advisorIDs = result.docs.map((doc) => doc.id)
  const municipalityIdsByAdvisor = await municipalityIdsByAdvisorIds(payload, advisorIDs)

  return {
    rows: result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email ?? null,
      phone: doc.phone ?? null,
      municipalityIDs: municipalityIdsByAdvisor.get(doc.id) ?? [],
    })),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export const loadAdvisorDetail = async (
  payload: Payload,
  advisorId: number,
): Promise<AdvisorDetailViewModel | null> => {
  if (!Number.isInteger(advisorId) || advisorId <= 0) return null

  let advisor: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
    role: string
  }
  try {
    // Intentional admin bypass — same rationale as `loadAdvisorListPageData`.
    advisor = await payload.findByID({
      collection: 'campaignUser',
      id: advisorId,
      depth: 0,
      select: { name: true, email: true, phone: true, role: true },
      overrideAccess: true,
    })
  } catch {
    return null
  }

  if (advisor.role !== 'advisor') return null

  const municipalitiesByAdvisor = await municipalitiesByAdvisorIds(payload, [advisor.id])
  return {
    id: advisor.id,
    name: advisor.name,
    email: advisor.email ?? null,
    phone: advisor.phone ?? null,
    municipalities: municipalitiesByAdvisor.get(advisor.id) ?? [],
  }
}
