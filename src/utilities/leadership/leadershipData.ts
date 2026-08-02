import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { SupportStatus } from '@/lib/schemas/leadership'
import { isSupportStatus } from '@/lib/schemas/leadership'
import type { WizardLeadershipTileViewModel } from '@/lib/wizardLeadershipContract'
import type { CampaignUser, Leadership } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildLeadershipListWhere,
  leadershipPageSize,
  resolveLeadershipListPayloadSort,
  resolveLeadershipListSort,
  type LeadershipListState,
} from '@/utilities/leadership/leadershipListUrl'
import { loadOrganizationNamesByIds } from '@/utilities/loadNamesByIds'
import { loadStateDeputySummaries, type StateDeputySummary } from '@/utilities/stateDeputyData'

export type LeadershipRowViewModel = {
  id: number
  contactID: number
  name: string
  phone: string | null
  email: string | null
  supportStatus: SupportStatus | null
  exclusive: boolean
  /**
   * Ids only: the "Municípios" cell renders chips through
   * `buildMunicipalityPortfolioChips` over the shared portfolio index, which
   * already carries every name/slug and is what collapses a whole território
   * into one chip. Resolving names here too would be a second source of truth.
   */
  municipalityIDs: number[]
  organizationNames: string[]
  stateDeputies: StateDeputySummary[]
  hasAppAccess: boolean
  /** Last write to the leadership row — the dossier's freshness readout. */
  updatedAt: string
}

const contactSummary = (
  contact: Leadership['contact'],
): { id: number; name: string; phone: string | null; email: string | null } => {
  if (typeof contact === 'object' && contact !== null) {
    return {
      id: contact.id,
      name: contact.name ?? 'Contato',
      phone: contact.phone ?? null,
      email: contact.email ?? null,
    }
  }
  return { id: Number(contact), name: 'Contato', phone: null, email: null }
}

const findMunicipalityLeadershipDocs = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
  sort = 'createdAt',
): Promise<Leadership[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: [municipalityID] } },
    depth: 1,
    limit: 0,
    pagination: false,
    sort,
    user,
    overrideAccess: false,
  })
  return result.docs as Leadership[]
}

const toWizardLeadershipTile = (doc: Leadership): WizardLeadershipTileViewModel => {
  const contact = contactSummary(doc.contact)
  return {
    id: doc.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    supportStatus: isSupportStatus(doc.supportStatus) ? doc.supportStatus : null,
    exclusive: doc.exclusive ?? true,
    notes: doc.notes ?? null,
  }
}

const organizationNamesForIds = (payload: Payload, ids: number[]): Promise<Map<number, string>> =>
  loadOrganizationNamesByIds(payload, ids)

const toLeadershipRows = async (
  payload: Payload,
  docs: Leadership[],
): Promise<LeadershipRowViewModel[]> => {
  const organizationIDs = new Set<number>()
  const stateDeputyIDs = new Set<number>()
  for (const doc of docs) {
    for (const organization of doc.organizations ?? []) {
      const id = relationshipId(organization)
      if (id !== null) organizationIDs.add(id)
    }
    for (const stateDeputy of doc.stateDeputies ?? []) {
      const id = relationshipId(stateDeputy)
      if (id !== null) stateDeputyIDs.add(id)
    }
  }

  const [organizationNames, stateDeputySummaries] = await Promise.all([
    organizationNamesForIds(payload, [...organizationIDs]),
    loadStateDeputySummaries(payload, [...stateDeputyIDs]),
  ])
  const stateDeputyById = new Map(stateDeputySummaries.map((summary) => [summary.id, summary]))

  return docs.map((doc) => {
    const contact = contactSummary(doc.contact)
    return {
      id: doc.id,
      contactID: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      supportStatus: isSupportStatus(doc.supportStatus) ? doc.supportStatus : null,
      exclusive: doc.exclusive ?? true,
      municipalityIDs: (doc.municipalities ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null),
      organizationNames: (doc.organizations ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => organizationNames.get(id) ?? 'Organização'),
      stateDeputies: (doc.stateDeputies ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => stateDeputyById.get(id))
        .filter((summary): summary is StateDeputySummary => summary !== undefined),
      hasAppAccess: relationshipId(doc.user) !== null,
      updatedAt: doc.updatedAt,
    }
  })
}

export const loadMunicipalityLeaderships = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<LeadershipRowViewModel[]> => {
  const docs = await findMunicipalityLeadershipDocs(payload, user, municipalityID)
  return toLeadershipRows(payload, docs)
}

export const loadWizardLeadershipTiles = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<WizardLeadershipTileViewModel[]> => {
  const docs = await findMunicipalityLeadershipDocs(payload, user, municipalityID)
  return docs
    .map(toWizardLeadershipTile)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}

/**
 * Dossier variant: only the `limit` most recently updated rows (sorted in
 * Postgres), plus the full count — avoids fetching every leadership of a
 * heavy município just to slice a handful.
 */
export const loadFreshestMunicipalityLeaderships = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
  limit: number,
): Promise<{ rows: LeadershipRowViewModel[]; totalCount: number }> => {
  const result = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: [municipalityID] } },
    depth: 1,
    limit,
    sort: '-updatedAt',
    user,
    overrideAccess: false,
  })
  return {
    rows: await toLeadershipRows(payload, result.docs as Leadership[]),
    totalCount: result.totalDocs,
  }
}

export type LeadershipListFilterFacets = {
  /** Municipality ids present under the other active filters (cross-filtered). */
  municipalityIDs: number[]
  /** Organization ids present under the other active filters (cross-filtered). */
  organizationIDs: number[]
  /** State deputy ids present under the other active filters (cross-filtered). */
  stateDeputyIDs: number[]
}

/**
 * Respects every OTHER filter (search, status, access) but drops the
 * municipality filter itself — same contract as `loadStateDeputyPartyFacet`:
 * a selected id is unioned in so it stays visible to undo.
 */
const loadLeadershipMunicipalityFacet = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<number[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: buildLeadershipListWhere({ ...state, municipalities: undefined }),
    depth: 0,
    limit: 0,
    pagination: false,
    select: { municipalities: true },
    user,
    overrideAccess: false,
  })

  const available = new Set<number>(state.municipalities ?? [])
  for (const doc of result.docs) {
    for (const municipality of doc.municipalities ?? []) {
      const id = relationshipId(municipality)
      if (id !== null) available.add(id)
    }
  }

  return [...available].sort((left, right) => left - right)
}

const loadLeadershipOrganizationFacet = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<number[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: buildLeadershipListWhere({ ...state, organizations: undefined }),
    depth: 0,
    limit: 0,
    pagination: false,
    select: { organizations: true },
    user,
    overrideAccess: false,
  })

  const available = new Set<number>(state.organizations ?? [])
  for (const doc of result.docs) {
    for (const organization of doc.organizations ?? []) {
      const id = relationshipId(organization)
      if (id !== null) available.add(id)
    }
  }

  return [...available].sort((left, right) => left - right)
}

const loadLeadershipStateDeputyFacet = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<number[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: buildLeadershipListWhere({ ...state, stateDeputies: undefined }),
    depth: 0,
    limit: 0,
    pagination: false,
    select: { stateDeputies: true },
    user,
    overrideAccess: false,
  })

  const available = new Set<number>(state.stateDeputies ?? [])
  for (const doc of result.docs) {
    for (const stateDeputy of doc.stateDeputies ?? []) {
      const id = relationshipId(stateDeputy)
      if (id !== null) available.add(id)
    }
  }

  return [...available].sort((left, right) => left - right)
}

const loadLeadershipFilterFacets = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<LeadershipListFilterFacets> => {
  const [municipalityIDs, organizationIDs, stateDeputyIDs] = await Promise.all([
    loadLeadershipMunicipalityFacet(payload, user, state),
    loadLeadershipOrganizationFacet(payload, user, state),
    loadLeadershipStateDeputyFacet(payload, user, state),
  ])
  return { municipalityIDs, organizationIDs, stateDeputyIDs }
}

export const loadLeadershipListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<{
  rows: LeadershipRowViewModel[]
  totalDocs: number
  totalPages: number
  filterFacets: LeadershipListFilterFacets
}> => {
  if (!isCampaignStaff(user)) {
    return {
      rows: [],
      totalDocs: 0,
      totalPages: 0,
      filterFacets: { municipalityIDs: [], organizationIDs: [], stateDeputyIDs: [] },
    }
  }

  const { sort, dir } = resolveLeadershipListSort(state)
  const [result, filterFacets] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: buildLeadershipListWhere(state),
      depth: 1,
      limit: leadershipPageSize,
      page: state.page,
      sort: resolveLeadershipListPayloadSort(sort, dir),
      user,
      overrideAccess: false,
    }),
    loadLeadershipFilterFacets(payload, user, state),
  ])

  return {
    rows: await toLeadershipRows(payload, result.docs as Leadership[]),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    filterFacets,
  }
}

export type LeadershipDetailViewModel = LeadershipRowViewModel & {
  municipalityIDs: number[]
  organizationIDs: number[]
  stateDeputyIDs: number[]
  notes: string | null
}

export const loadLeadershipDetail = async (
  payload: Payload,
  user: CampaignUser,
  leadershipID: number,
): Promise<LeadershipDetailViewModel | null> => {
  const result = await payload.find({
    collection: 'leadership',
    where: { id: { equals: leadershipID } },
    depth: 1,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const doc = result.docs[0] as Leadership | undefined
  if (!doc) return null

  const [row] = await toLeadershipRows(payload, [doc])
  if (!row) return null

  return {
    ...row,
    municipalityIDs: (doc.municipalities ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    organizationIDs: (doc.organizations ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    stateDeputyIDs: row.stateDeputies.map((summary) => summary.id),
    notes: doc.notes ?? null,
  }
}
