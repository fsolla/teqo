import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser, StateDeputy } from '@/payload-types'
import { populatedContactName, relationshipId } from '@/utilities/relationship'
import {
  buildStateDeputyListWhere,
  NO_PARTY_FILTER_VALUE,
  resolveStateDeputyListPayloadSort,
  resolveStateDeputyListSort,
  stateDeputyPageSize,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

type LeadershipRelationSummary = {
  id: number
  name: string
}

export type StateDeputyRowViewModel = {
  id: number
  name: string
  slug: string
  party: string | null
  municipalityCount: number
  leaderships: LeadershipRelationSummary[]
}

/** Values still reachable under the OTHER active filters (the Partido popover). */
export type StateDeputyListFilterFacets = {
  parties: string[]
  hasNoParty: boolean
}

/**
 * Respects the search (an OTHER filter, from the popover's point of view) but
 * drops the party filter itself — same contract as
 * `loadMunicipalityListFilterFacets`: a selected value is unioned in so it
 * stays visible to undo even if the search would otherwise hide it.
 */
const loadStateDeputyPartyFacet = async (
  payload: Payload,
  user: CampaignUser,
  state: StateDeputyListState,
): Promise<StateDeputyListFilterFacets> => {
  const result = await payload.find({
    collection: 'stateDeputy',
    where: buildStateDeputyListWhere({ ...state, parties: undefined }),
    depth: 0,
    limit: 0,
    pagination: false,
    select: { party: true },
    user,
    overrideAccess: false,
  })

  const availableParties = new Set<string>(
    (state.parties ?? []).filter((party) => party !== NO_PARTY_FILTER_VALUE),
  )
  let hasNoParty = (state.parties ?? []).includes(NO_PARTY_FILTER_VALUE)

  for (const doc of result.docs) {
    if (doc.party) availableParties.add(doc.party)
    else hasNoParty = true
  }

  return {
    parties: [...availableParties].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    hasNoParty,
  }
}

export const loadStateDeputyListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: StateDeputyListState,
): Promise<{
  rows: StateDeputyRowViewModel[]
  totalDocs: number
  totalPages: number
  filterFacets: StateDeputyListFilterFacets
}> => {
  const { sort, dir } = resolveStateDeputyListSort(state)
  const [result, filterFacets] = await Promise.all([
    payload.find({
      collection: 'stateDeputy',
      where: buildStateDeputyListWhere(state),
      depth: 0,
      limit: stateDeputyPageSize,
      page: state.page,
      sort: resolveStateDeputyListPayloadSort(sort, dir),
      select: { name: true, slug: true, party: true },
      user,
      overrideAccess: false,
    }),
    loadStateDeputyPartyFacet(payload, user, state),
  ])

  const stateDeputyIDs = result.docs.map((doc) => doc.id)
  const municipalityCounts = new Map<number, number>()
  const leadershipsByDeputy = new Map<number, LeadershipRelationSummary[]>()

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
        depth: 1,
        limit: 0,
        pagination: false,
        select: { stateDeputies: true, contact: true },
        // Names ship in the list cell — honour canReadLeadership (unlike
        // municipalityCounts above, which stays aggregate-only).
        user,
        overrideAccess: false,
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
      const summary: LeadershipRelationSummary = {
        id: leadership.id,
        name: populatedContactName(leadership.contact),
      }
      for (const deputy of leadership.stateDeputies ?? []) {
        const id = relationshipId(deputy)
        if (id !== null && stateDeputyIDs.includes(id)) {
          const list = leadershipsByDeputy.get(id) ?? []
          list.push(summary)
          leadershipsByDeputy.set(id, list)
        }
      }
    }

    for (const [id, list] of leadershipsByDeputy) {
      list.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      leadershipsByDeputy.set(id, list)
    }
  }

  return {
    rows: result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      party: doc.party ?? null,
      municipalityCount: municipalityCounts.get(doc.id) ?? 0,
      leaderships: leadershipsByDeputy.get(doc.id) ?? [],
    })),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterFacets,
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
    leaderships: leaderships.docs.map((leadership) => ({
      id: leadership.id,
      name: populatedContactName(leadership.contact),
    })),
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
