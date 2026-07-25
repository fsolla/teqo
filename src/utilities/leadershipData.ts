import 'server-only'

import type { Payload } from 'payload'

import type { SupportStatus } from '@/lib/schemas/leadership'
import { isSupportStatus } from '@/lib/schemas/leadership'
import type { CampaignUser, Leadership } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildListHref,
  firstValue,
  normalizedText,
  strictDecimalInteger,
  type RawSearchParams,
} from '@/utilities/campaignListUrl'
import { relationshipId } from '@/utilities/relationship'
import { loadStateDeputySummaries, type StateDeputySummary } from '@/utilities/stateDeputyData'

const leadershipPageSize = 25

export type LeadershipRowViewModel = {
  id: number
  contactID: number
  name: string
  phone: string | null
  supportStatus: SupportStatus | null
  sector: string | null
  municipalityNames: string[]
  organizationNames: string[]
  stateDeputyNames: string[]
  hasAppAccess: boolean
  /** Last write to the leadership row — the dossier's freshness readout. */
  updatedAt: string
}

const contactNameAndPhone = (
  contact: Leadership['contact'],
): { id: number; name: string; phone: string | null } => {
  if (typeof contact === 'object' && contact !== null) {
    return {
      id: contact.id,
      name: contact.name ?? 'Contato',
      phone: (contact as { phone?: string | null }).phone ?? null,
    }
  }
  return { id: Number(contact), name: 'Contato', phone: null }
}

const namesForIds = async (
  payload: Payload,
  collection: 'municipality' | 'organization' | 'stateDeputy',
  ids: number[],
): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()
  // Intentional admin bypass: display-name resolution for rows the actor
  // already passed row-level access on.
  const result = await payload.find({
    collection,
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })
  return new Map(result.docs.map((doc) => [doc.id, doc.name]))
}

const toLeadershipRows = async (
  payload: Payload,
  docs: Leadership[],
): Promise<LeadershipRowViewModel[]> => {
  const municipalityIDs = new Set<number>()
  const organizationIDs = new Set<number>()
  const stateDeputyIDs = new Set<number>()
  for (const doc of docs) {
    for (const municipality of doc.municipalities ?? []) {
      const id = relationshipId(municipality)
      if (id !== null) municipalityIDs.add(id)
    }
    for (const organization of doc.organizations ?? []) {
      const id = relationshipId(organization)
      if (id !== null) organizationIDs.add(id)
    }
    for (const stateDeputy of doc.stateDeputies ?? []) {
      const id = relationshipId(stateDeputy)
      if (id !== null) stateDeputyIDs.add(id)
    }
  }

  const [municipalityNames, organizationNames, stateDeputyNames] = await Promise.all([
    namesForIds(payload, 'municipality', [...municipalityIDs]),
    namesForIds(payload, 'organization', [...organizationIDs]),
    namesForIds(payload, 'stateDeputy', [...stateDeputyIDs]),
  ])

  return docs.map((doc) => {
    const contact = contactNameAndPhone(doc.contact)
    return {
      id: doc.id,
      contactID: contact.id,
      name: contact.name,
      phone: contact.phone,
      supportStatus: isSupportStatus(doc.supportStatus) ? doc.supportStatus : null,
      sector: doc.sector ?? null,
      municipalityNames: (doc.municipalities ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => municipalityNames.get(id) ?? 'Município'),
      organizationNames: (doc.organizations ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => organizationNames.get(id) ?? 'Organização'),
      stateDeputyNames: (doc.stateDeputies ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => stateDeputyNames.get(id) ?? 'Dobradinha'),
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
  const result = await payload.find({
    collection: 'leadership',
    where: { municipalities: { in: [municipalityID] } },
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'createdAt',
    user,
    overrideAccess: false,
  })
  return toLeadershipRows(payload, result.docs as Leadership[])
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

export type LeadershipListState = {
  page: number
  q?: string
}

export const parseLeadershipListParams = (searchParams: RawSearchParams): LeadershipListState => {
  const q = normalizedText(firstValue(searchParams.q))
  return {
    page: strictDecimalInteger(firstValue(searchParams.page)) ?? 1,
    ...(q ? { q } : {}),
  }
}

const buildLeadershipListSearchParams = (
  state: LeadershipListState,
  page = state.page,
): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (page > 1) params.set('page', String(page))
  return params
}

export const buildLeadershipListHref = (state: LeadershipListState, page: number): string =>
  buildListHref(state, buildLeadershipListSearchParams, '/campanha/liderancas', page)

export const loadLeadershipListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: LeadershipListState,
): Promise<{ rows: LeadershipRowViewModel[]; totalDocs: number; totalPages: number }> => {
  if (!isCampaignStaff(user)) return { rows: [], totalDocs: 0, totalPages: 0 }

  let contactFilter: { contact: { in: number[] } } | null = null
  if (state.q) {
    // Names live on Contact — resolve matching contact ids first.
    const contacts = await payload.find({
      collection: 'contact',
      where: { name: { contains: state.q } },
      depth: 0,
      limit: 200,
      pagination: false,
      select: { name: true },
      overrideAccess: true,
    })
    contactFilter = { contact: { in: contacts.docs.map((contact) => contact.id) } }
    if (contacts.docs.length === 0) return { rows: [], totalDocs: 0, totalPages: 0 }
  }

  const result = await payload.find({
    collection: 'leadership',
    where: contactFilter ?? {},
    depth: 1,
    limit: leadershipPageSize,
    page: state.page,
    sort: '-updatedAt',
    user,
    overrideAccess: false,
  })

  return {
    rows: await toLeadershipRows(payload, result.docs as Leadership[]),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export type LeadershipDetailViewModel = LeadershipRowViewModel & {
  municipalityIDs: number[]
  organizationIDs: number[]
  stateDeputyIDs: number[]
  stateDeputies: StateDeputySummary[]
  email: string | null
  sectorNotes: string | null
  notes: string | null
  consentNote: string | null
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

  const contact = doc.contact
  const email =
    typeof contact === 'object' && contact !== null
      ? ((contact as { email?: string | null }).email ?? null)
      : null

  const stateDeputyIDs = (doc.stateDeputies ?? [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
  const stateDeputies = await loadStateDeputySummaries(payload, stateDeputyIDs)

  return {
    ...row,
    municipalityIDs: (doc.municipalities ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    organizationIDs: (doc.organizations ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    stateDeputyIDs,
    stateDeputies,
    email,
    sectorNotes: doc.sectorNotes ?? null,
    notes: doc.notes ?? null,
    consentNote: doc.consentNote ?? null,
  }
}
