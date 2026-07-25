import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser, Leadership, StateDeputy } from '@/payload-types'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import { relationshipId } from '@/utilities/relationship'

export const stateDeputyPageSize = 25

export type StateDeputyRowViewModel = {
  id: number
  name: string
  slug: string
  party: string | null
  municipalityCount: number
  leadershipCount: number
}

export type StateDeputyListState = {
  page: number
  q?: string
}

export const parseStateDeputyListParams = (
  searchParams: RawSearchParams,
): StateDeputyListState => {
  const q = normalizedText(firstValue(searchParams.q))
  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(q ? { q } : {}),
  }
}

const buildStateDeputyListSearchParams = (
  state: StateDeputyListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildStateDeputyListHref = (state: StateDeputyListState, page: number): string =>
  buildListHref(state, buildStateDeputyListSearchParams, '/campanha/dobradinhas', page)

export const loadStateDeputyListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: StateDeputyListState,
): Promise<{ rows: StateDeputyRowViewModel[]; totalDocs: number; totalPages: number }> => {
  const result = await payload.find({
    collection: 'stateDeputy',
    where: state.q ? { name: { contains: state.q } } : {},
    depth: 0,
    limit: stateDeputyPageSize,
    page: state.page,
    sort: 'name',
    user,
    overrideAccess: false,
  })

  const stateDeputyIDs = result.docs.map((doc) => doc.id)
  const municipalityCounts = new Map<number, number>()
  const leadershipCounts = new Map<number, number>()

  if (stateDeputyIDs.length) {
    const [municipalities, leaderships] = await Promise.all([
      payload.find({
        collection: 'municipality',
        where: { stateDeputies: { in: stateDeputyIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { stateDeputies: true },
        overrideAccess: true,
      }),
      payload.find({
        collection: 'leadership',
        where: { stateDeputies: { in: stateDeputyIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { stateDeputies: true },
        overrideAccess: true,
      }),
    ])

    for (const municipality of municipalities.docs) {
      for (const deputy of municipality.stateDeputies ?? []) {
        const id = relationshipId(deputy)
        if (id !== null && stateDeputyIDs.includes(id)) {
          municipalityCounts.set(id, (municipalityCounts.get(id) ?? 0) + 1)
        }
      }
    }

    for (const leadership of leaderships.docs) {
      for (const deputy of leadership.stateDeputies ?? []) {
        const id = relationshipId(deputy)
        if (id !== null && stateDeputyIDs.includes(id)) {
          leadershipCounts.set(id, (leadershipCounts.get(id) ?? 0) + 1)
        }
      }
    }
  }

  return {
    rows: result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      party: doc.party ?? null,
      municipalityCount: municipalityCounts.get(doc.id) ?? 0,
      leadershipCount: leadershipCounts.get(doc.id) ?? 0,
    })),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export type StateDeputySummary = {
  id: number
  name: string
  slug: string
  party: string | null
}

export type StateDeputyDetailViewModel = StateDeputySummary & {
  notes: string | null
  municipalities: Array<{ id: number; name: string; slug: string }>
  leaderships: Array<{ id: number; name: string }>
}

export const loadStateDeputyDetail = async (
  payload: Payload,
  user: CampaignUser,
  slug: string,
): Promise<StateDeputyDetailViewModel | null> => {
  const result = await payload.find({
    collection: 'stateDeputy',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const stateDeputy = result.docs[0] as StateDeputy | undefined
  if (!stateDeputy) return null

  const [municipalities, leaderships] = await Promise.all([
    payload.find({
      collection: 'municipality',
      where: { stateDeputies: { in: [stateDeputy.id] } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'name',
      select: { name: true, slug: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'leadership',
      where: { stateDeputies: { in: [stateDeputy.id] } },
      depth: 1,
      limit: 0,
      pagination: false,
      sort: 'createdAt',
      user,
      overrideAccess: false,
    }),
  ])

  return {
    id: stateDeputy.id,
    name: stateDeputy.name,
    slug: stateDeputy.slug,
    party: stateDeputy.party ?? null,
    notes: stateDeputy.notes ?? null,
    municipalities: municipalities.docs.map((municipality) => ({
      id: municipality.id,
      name: municipality.name,
      slug: municipality.slug,
    })),
    leaderships: leaderships.docs.map((leadership) => {
      const contact = leadership.contact as Leadership['contact']
      return {
        id: leadership.id,
        name:
          typeof contact === 'object' && contact !== null && 'name' in contact
            ? String(contact.name)
            : 'Contato',
      }
    }),
  }
}

export const loadStateDeputySummaries = async (
  payload: Payload,
  ids: number[],
): Promise<StateDeputySummary[]> => {
  if (ids.length === 0) return []

  const result = await payload.find({
    collection: 'stateDeputy',
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'name',
    select: { name: true, slug: true, party: true },
    overrideAccess: true,
  })

  const byId = new Map(
    result.docs.map((doc) => [
      doc.id,
      {
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        party: doc.party ?? null,
      },
    ]),
  )

  return ids.flatMap((id) => {
    const summary = byId.get(id)
    return summary ? [summary] : []
  })
}
