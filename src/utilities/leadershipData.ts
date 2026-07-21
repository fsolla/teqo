import type { Payload } from 'payload'

import type { SupportStatus } from '@/lib/schemas/leadership'
import { isSupportStatus } from '@/lib/schemas/leadership'
import type { CampaignUser, Leadership } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { relationshipId, requireRelationshipId } from '@/utilities/relationship'

export const leadershipPageSize = 25

export type LeadershipRowViewModel = {
  id: number
  contactID: number
  name: string
  phone: string | null
  supportStatus: SupportStatus | null
  sector: string | null
  plazaNames: string[]
  organizationNames: string[]
  hasAppAccess: boolean
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
  collection: 'plaza' | 'organization',
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
  const plazaIDs = new Set<number>()
  const organizationIDs = new Set<number>()
  for (const doc of docs) {
    for (const plaza of doc.plazas ?? []) {
      const id = relationshipId(plaza)
      if (id !== null) plazaIDs.add(id)
    }
    for (const organization of doc.organizations ?? []) {
      const id = relationshipId(organization)
      if (id !== null) organizationIDs.add(id)
    }
  }

  const [plazaNames, organizationNames] = await Promise.all([
    namesForIds(payload, 'plaza', [...plazaIDs]),
    namesForIds(payload, 'organization', [...organizationIDs]),
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
      plazaNames: (doc.plazas ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => plazaNames.get(id) ?? 'Praça'),
      organizationNames: (doc.organizations ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => organizationNames.get(id) ?? 'Organização'),
      hasAppAccess: relationshipId(doc.user) !== null,
    }
  })
}

export const loadPlazaLeaderships = async (
  payload: Payload,
  user: CampaignUser,
  plazaID: number,
): Promise<LeadershipRowViewModel[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: { plazas: { in: [plazaID] } },
    depth: 1,
    limit: 0,
    pagination: false,
    sort: 'createdAt',
    user,
    overrideAccess: false,
  })
  return toLeadershipRows(payload, result.docs as Leadership[])
}

export type LeadershipListState = {
  page: number
  q?: string
}

export const parseLeadershipListParams = (
  searchParams: Record<string, string | string[] | undefined>,
): LeadershipListState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const q = first(searchParams.q)?.trim()
  const rawPage = first(searchParams.page)

  return {
    page: rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1,
    ...(q ? { q } : {}),
  }
}

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
  plazaIDs: number[]
  organizationIDs: number[]
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

  return {
    ...row,
    plazaIDs: (doc.plazas ?? []).map(relationshipId).filter((id): id is number => id !== null),
    organizationIDs: (doc.organizations ?? [])
      .map(relationshipId)
      .filter((id): id is number => id !== null),
    email,
    sectorNotes: doc.sectorNotes ?? null,
    notes: doc.notes ?? null,
    consentNote: doc.consentNote ?? null,
  }
}

export const requireLeadershipContactId = (leadership: Leadership): number =>
  requireRelationshipId(leadership.contact)
