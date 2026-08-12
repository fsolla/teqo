import 'server-only'

import type { Payload } from 'payload'

import { phoneValuesOf, primaryPhoneOf } from '@/lib/phone'
import { populatedContactName, relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import type { CampaignUser, StateDeputy } from '@/payload-types'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/campaignListUrl'
import { loadCampaignUserSummaries } from '@/utilities/campaignRelationOptions'
import {
  buildStateDeputyListWhere,
  resolveStateDeputyListPayloadSort,
  resolveStateDeputyListSort,
  stateDeputyPageSize,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

type NamedRelationSummary = {
  id: number
  name: string
}

export type StateDeputyRowViewModel = {
  id: number
  name: string
  email: string | null
  phone: string | null
  slug: string
  party: string | null
  /** C129 — the "nome de legenda" (ballot name), shown discreet under the name. */
  ballotName: string | null
  municipalityIDs: number[]
  leaderships: NamedRelationSummary[]
  /** B156 — the staff responsible for this dobradinha, names resolved. */
  advisors: NamedRelationSummary[]
}

const stateDeputyContactSummary = (
  contact: StateDeputy['contact'],
): { id: number; name: string; email: string | null; phone: string | null } => {
  if (typeof contact === 'object' && contact !== null) {
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email ?? null,
      phone: primaryPhoneOf(contact.phones),
    }
  }

  return { id: Number(contact), name: 'Contato', email: null, phone: null }
}

/** Values still reachable under the OTHER active filters (the Partido popover). */
export type StateDeputyListFilterFacets = {
  parties: string[]
  hasNoParty: boolean
}

/**
 * Municipality ids per state deputy for the LIST / home search — aggregate
 * only, same admin bypass as `loadStateDeputyListPageData`.
 */
export const municipalityIdsByStateDeputyIds = async (
  payload: Payload,
  stateDeputyIDs: number[],
): Promise<Map<number, number[]>> => {
  const byDeputy = new Map<number, number[]>()
  if (stateDeputyIDs.length === 0) return byDeputy

  const deputyIdSet = new Set(stateDeputyIDs)
  const municipalities = await payload.find({
    collection: 'municipality',
    where: { stateDeputies: { in: stateDeputyIDs } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { stateDeputies: true },
    // Intentional admin bypass: aggregate counts only (B34 precedent).
    overrideAccess: true,
  })

  for (const municipality of municipalities.docs) {
    for (const deputy of municipality.stateDeputies ?? []) {
      const id = relationshipId(deputy)
      if (id === null || !deputyIdSet.has(id)) continue
      const list = byDeputy.get(id) ?? []
      list.push(municipality.id)
      byDeputy.set(id, list)
    }
  }

  return byDeputy
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
      depth: 1,
      limit: stateDeputyPageSize,
      page: state.page,
      sort: resolveStateDeputyListPayloadSort(sort, dir),
      select: { contact: true, slug: true, party: true, ballotName: true, advisors: true },
      user,
      overrideAccess: false,
    }),
    loadStateDeputyPartyFacet(payload, user, state),
  ])

  const stateDeputyIDs = result.docs.map((doc) => doc.id)
  const leadershipsByDeputy = new Map<number, NamedRelationSummary[]>()
  const advisorsByDeputy = new Map<number, NamedRelationSummary[]>()

  const municipalityIDsByDeputy =
    stateDeputyIDs.length > 0
      ? await municipalityIdsByStateDeputyIds(payload, stateDeputyIDs)
      : new Map<number, number[]>()

  if (stateDeputyIDs.length) {
    // B156 — one name lookup for every row's assigned advisors, same
    // aggregate-over-ids shape as the leaderships query below. The `advisors`
    // field is already on each doc (depth 0 → ids).
    const advisorIDs = [
      ...new Set(result.docs.flatMap((doc) => uniqueRelationshipIds(doc.advisors))),
    ]
    if (advisorIDs.length) {
      const summaries = await loadCampaignUserSummaries(payload, user, advisorIDs)
      const summaryById = new Map(summaries.map((summary) => [summary.id, summary]))
      for (const doc of result.docs) {
        const list = uniqueRelationshipIds(doc.advisors)
          .map((id) => summaryById.get(id))
          .filter((summary): summary is NamedRelationSummary => summary !== undefined)
        advisorsByDeputy.set(doc.id, list)
      }
    }

    const leaderships = await payload.find({
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
    })

    for (const leadership of leaderships.docs) {
      const summary: NamedRelationSummary = {
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
      ...stateDeputyContactSummary(doc.contact),
      id: doc.id,
      slug: doc.slug,
      party: doc.party ?? null,
      ballotName: doc.ballotName ?? null,
      municipalityIDs: municipalityIDsByDeputy.get(doc.id) ?? [],
      leaderships: leadershipsByDeputy.get(doc.id) ?? [],
      advisors: advisorsByDeputy.get(doc.id) ?? [],
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
  email: string | null
  phone: string | null
  /** C129 — the "nome de legenda" (ballot name), shown discreet under the name. */
  ballotName: string | null
  /** Every number of the ficha, order = priority (C112) — primary first. */
  phones: string[]
  notes: string | null
  municipalities: Array<{ id: number; name: string; slug: string }>
  leaderships: Array<{ id: number; name: string }>
  /** B156 — staff responsible for this dobradinha. */
  advisors: Array<{ id: number; name: string }>
}

export const loadStateDeputyDetail = async (
  payload: Payload,
  user: CampaignUser,
  identifier: string,
): Promise<StateDeputyDetailViewModel | null> => {
  const numericCandidate = /^[1-9]\d*$/.test(identifier) ? Number(identifier) : null
  const numericID =
    numericCandidate !== null && Number.isSafeInteger(numericCandidate) ? numericCandidate : null
  const result = await payload.find({
    collection: 'stateDeputy',
    where:
      numericID === null
        ? { slug: { equals: identifier } }
        : { or: [{ id: { equals: numericID } }, { slug: { equals: identifier } }] },
    depth: 1,
    limit: numericID === null ? 1 : 2,
    pagination: false,
    user,
    overrideAccess: false,
  })
  // Numeric legacy slugs are rare but valid; an actual ID wins when both exist.
  const stateDeputy = (
    numericID === null
      ? result.docs[0]
      : (result.docs.find((doc) => doc.id === numericID) ?? result.docs[0])
  ) as StateDeputy | undefined
  if (!stateDeputy) return null

  const [municipalities, leaderships, advisorSummaries] = await Promise.all([
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
    loadCampaignUserSummaries(payload, user, uniqueRelationshipIds(stateDeputy.advisors)),
  ])

  const contactSummary = stateDeputyContactSummary(stateDeputy.contact)
  const contact = stateDeputy.contact

  return {
    ...contactSummary,
    phones: phoneValuesOf(typeof contact === 'object' && contact !== null ? contact.phones : null),
    id: stateDeputy.id,
    slug: stateDeputy.slug,
    party: stateDeputy.party ?? null,
    ballotName: stateDeputy.ballotName ?? null,
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
    advisors: advisorSummaries,
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
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'contact.name',
    select: { contact: true, slug: true, party: true },
    // Intentional admin bypass: id lookups for the home-search card, no
    // actor-scoping possible or needed (B52 precedent).
    overrideAccess: true,
  })

  const byId = new Map(
    result.docs.map((doc) => [
      doc.id,
      {
        id: doc.id,
        name: stateDeputyContactSummary(doc.contact).name,
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
