import 'server-only'

import type { Payload } from 'payload'

import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { AdvisorMunicipalityIndexEntry } from '@/lib/advisorMunicipalityPortfolio'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import { relationshipId } from '@/utilities/relationship'

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

export type AdvisorRowViewModel = {
  id: number
  name: string
  email: string | null
  phone: string | null
  municipalities: AdvisorMunicipalityViewModel[]
}

export type AdvisorDetailViewModel = AdvisorRowViewModel

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

const municipalitiesByAdvisorIds = async (
  payload: Payload,
  advisorIDs: number[],
): Promise<Map<number, AdvisorMunicipalityViewModel[]>> => {
  const byAdvisor = new Map<number, AdvisorMunicipalityViewModel[]>()
  if (advisorIDs.length === 0) return byAdvisor

  const advisorIdSet = new Set(advisorIDs)

  // Intentional admin bypass: portfolio labels only, over advisor rows already
  // resolved after the unrestricted route gate.
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
    const view: AdvisorMunicipalityViewModel = {
      id: municipality.id,
      name: municipality.name,
      slug: municipality.slug,
    }
    for (const advisor of municipality.advisors ?? []) {
      const id = relationshipId(advisor)
      if (id === null || !advisorIdSet.has(id)) continue
      const list = byAdvisor.get(id)
      if (list) list.push(view)
      else byAdvisor.set(id, [view])
    }
  }

  return byAdvisor
}

/**
 * Full municipality index for client-side portfolio search (município / TI / ZE).
 * Intentional admin bypass after the unrestricted route gate.
 */
export const loadAdvisorMunicipalityIndex = async (
  payload: Payload,
): Promise<AdvisorMunicipalityIndexEntry[]> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, slug: true, region: true, city: true, zoneNumber: true },
    overrideAccess: true,
  })

  return result.docs.map((municipality) => ({
    id: municipality.id,
    name: municipality.name,
    slug: municipality.slug,
    region: municipality.region as BahiaIdentityTerritory,
    city: municipality.city,
    zoneNumber: municipality.zoneNumber ?? null,
  }))
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
  const municipalitiesByAdvisor = await municipalitiesByAdvisorIds(payload, advisorIDs)

  return {
    rows: result.docs.map((doc) => {
      const email = doc.email ?? null
      return {
        id: doc.id,
        name: doc.name,
        email,
        phone: doc.phone ?? null,
        municipalities: municipalitiesByAdvisor.get(doc.id) ?? [],
      }
    }),
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
