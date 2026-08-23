import 'server-only'

import type { Payload } from 'payload'

import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  municipalityUpdatePolarities,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser, MunicipalityUpdate } from '@/payload-types'
import {
  assignableUpdateStaffWhere,
  resolveMunicipalityUpdateCapabilities,
  type MunicipalityUpdateDeliberationCapabilities,
} from '@/utilities/campaignAccess'
import { loadCampaignUserNamesByIds } from '@/utilities/loadNamesByIds'

export const municipalityUpdatesPageSize = 10

export type MunicipalityUpdateCommentViewModel = {
  id: string | null
  authorName: string
  createdAt: string | null
  body: string
}

export type MunicipalityUpdateViewModel = {
  id: number
  authorName: string
  createdAt: string
  body: string | null
  polarity: MunicipalityUpdatePolarity
  urgent: boolean
  activeVolunteers: number | null
  newSupports: number | null
  adversarySignal: boolean
  responsibleId: number | null
  responsibleName: string | null
  resolvedAt: string | null
  resolvedByName: string | null
  comments: MunicipalityUpdateCommentViewModel[]
}

export type EligibleUpdateStaffMember = {
  id: number
  name: string
  /** Assignable roles only — `assignableUpdateStaffWhere` never returns a leader. */
  role: 'coordinator' | 'advisor' | 'candidate'
}

export type MunicipalityUpdateDeliberationContext = {
  eligibleStaff: EligibleUpdateStaffMember[]
  capabilities: MunicipalityUpdateDeliberationCapabilities
}

export type MunicipalityUpdateFeedState = {
  page: number
}

export const parseMunicipalityUpdateFeedParams = (
  searchParams: Record<string, string | string[] | undefined>,
): MunicipalityUpdateFeedState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawPage = first(searchParams.updatePage)
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1

  return { page }
}

/** One doc → view-model mapping, shared by the feed and the list batch (B193). */
const toMunicipalityUpdateViewModel = (
  update: MunicipalityUpdate,
  namesById: ReadonlyMap<number, string>,
): MunicipalityUpdateViewModel => {
  const polarity = update.polarity as MunicipalityUpdatePolarity | undefined
  const responsibleId = relationshipId(update.responsible)
  const resolvedById = relationshipId(update.resolvedBy)
  return {
    id: update.id,
    authorName: namesById.get(relationshipId(update.author) ?? -1) ?? 'Usuário',
    createdAt: update.createdAt,
    body: update.body ?? null,
    polarity: polarity && municipalityUpdatePolarities.includes(polarity) ? polarity : 'neutra',
    urgent: Boolean(update.urgent),
    activeVolunteers: update.activeVolunteers ?? null,
    newSupports: update.newSupports ?? null,
    adversarySignal: Boolean(update.adversarySignal),
    responsibleId,
    responsibleName: responsibleId === null ? null : (namesById.get(responsibleId) ?? 'Usuário'),
    resolvedAt: update.resolvedAt ?? null,
    resolvedByName: resolvedById === null ? null : (namesById.get(resolvedById) ?? 'Usuário'),
    comments: (update.comments ?? []).map((comment) => ({
      id: comment.id ?? null,
      authorName: namesById.get(relationshipId(comment.author) ?? -1) ?? 'Usuário',
      createdAt: comment.createdAt ?? null,
      body: comment.body,
    })),
  }
}

const loadUpdateAuthorNames = async (
  payload: Payload,
  updates: MunicipalityUpdate[],
): Promise<ReadonlyMap<number, string>> => {
  const authorIDs = new Set<number>()
  for (const update of updates) {
    const authorID = relationshipId(update.author)
    if (authorID !== null) authorIDs.add(authorID)
    const responsibleID = relationshipId(update.responsible)
    if (responsibleID !== null) authorIDs.add(responsibleID)
    const resolvedByID = relationshipId(update.resolvedBy)
    if (resolvedByID !== null) authorIDs.add(resolvedByID)
    for (const comment of update.comments ?? []) {
      const commentAuthorID = relationshipId(comment.author)
      if (commentAuthorID !== null) authorIDs.add(commentAuthorID)
    }
  }
  return loadCampaignUserNamesByIds(payload, [...authorIDs])
}

/**
 * C88 — staff eligible to be assigned as responsible: advisors of the
 * municipalities on the page plus coordinator/candidate (unrestricted), the
 * same rule the server action enforces. Scoped reads (`overrideAccess: false`)
 * keep the advisor's portfolio: municipalities outside it return no rows, and
 * campaign users are readable by any campaign user.
 */
const loadMunicipalityUpdateEligibleStaff = async (
  payload: Payload,
  user: CampaignUser,
  municipalityIDs: readonly number[],
): Promise<EligibleUpdateStaffMember[]> => {
  const ids = [...new Set(municipalityIDs)]
  if (ids.length === 0) return []

  const municipalities = await payload.find({
    collection: 'municipality',
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { advisors: true },
    user,
    overrideAccess: false,
  })
  const advisorIDs = uniqueRelationshipIds(
    municipalities.docs.flatMap((municipality) => municipality.advisors),
  )

  const staff = await payload.find({
    collection: 'campaignUser',
    where: assignableUpdateStaffWhere(advisorIDs),
    depth: 0,
    limit: 0,
    pagination: false,
    select: { id: true, name: true, role: true },
    user,
    overrideAccess: false,
  })

  return staff.docs
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      role: doc.role as EligibleUpdateStaffMember['role'],
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}

/**
 * C88 — deliberation capabilities + eligible staff for the municipalities a
 * feed page renders. The staff list is only loaded when the actor can assign
 * (coordinator/candidate) — advisors comment but never assign.
 */
export const loadMunicipalityUpdateDeliberationContext = async (
  payload: Payload,
  user: CampaignUser,
  municipalityIDs: readonly number[],
): Promise<MunicipalityUpdateDeliberationContext> => {
  const capabilities = resolveMunicipalityUpdateCapabilities(user)
  const eligibleStaff = capabilities.canAssign
    ? await loadMunicipalityUpdateEligibleStaff(payload, user, municipalityIDs)
    : []
  return { eligibleStaff, capabilities }
}

export const loadMunicipalityUpdatesFeed = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
  state: MunicipalityUpdateFeedState,
): Promise<{
  updates: MunicipalityUpdateViewModel[]
  totalDocs: number
  totalPages: number
  page: number
  deliberation: MunicipalityUpdateDeliberationContext
}> => {
  const result = await payload.find({
    collection: 'municipalityUpdate',
    where: {
      municipality: { equals: municipalityID },
    },
    depth: 0,
    limit: municipalityUpdatesPageSize,
    page: state.page,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  const docs = result.docs as MunicipalityUpdate[]
  const [namesById, deliberation] = await Promise.all([
    loadUpdateAuthorNames(payload, docs),
    loadMunicipalityUpdateDeliberationContext(payload, user, [municipalityID]),
  ])

  return {
    updates: docs.map((update) => toMunicipalityUpdateViewModel(update, namesById)),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? state.page,
    deliberation,
  }
}

export const loadMunicipalityUpdatesPreview = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<{
  updates: MunicipalityUpdateViewModel[]
  deliberation: MunicipalityUpdateDeliberationContext
}> => {
  const feed = await loadMunicipalityUpdatesFeed(payload, user, municipalityID, { page: 1 })
  return { updates: feed.updates.slice(0, 3), deliberation: feed.deliberation }
}

/**
 * B193 — the LAST update per listed municipality, for the mobile card's
 * expandable footer. One batch over the visible page ids: docs arrive sorted
 * by `-createdAt`, so the first row per municipality is the latest. The read
 * runs with `overrideAccess: false`, so `canReadMunicipalityUpdate` scopes it
 * to the actor's portfolio exactly like the C89 feed loader.
 */
export const loadMunicipalityLastUpdates = async (
  payload: Payload,
  user: CampaignUser,
  municipalityIDs: readonly number[],
): Promise<ReadonlyMap<number, MunicipalityUpdateViewModel>> => {
  const ids = [...new Set(municipalityIDs)]
  if (ids.length === 0) return new Map()

  const result = await payload.find({
    collection: 'municipalityUpdate',
    where: { municipality: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: '-createdAt',
    select: {
      municipality: true,
      author: true,
      polarity: true,
      urgent: true,
      activeVolunteers: true,
      newSupports: true,
      adversarySignal: true,
      body: true,
      createdAt: true,
    },
    user,
    overrideAccess: false,
  })

  const authorNameById = await loadUpdateAuthorNames(payload, result.docs as MunicipalityUpdate[])

  const lastByMunicipality = new Map<number, MunicipalityUpdateViewModel>()
  for (const update of result.docs as MunicipalityUpdate[]) {
    const municipalityID = relationshipId(update.municipality)
    if (municipalityID === null || lastByMunicipality.has(municipalityID)) continue
    lastByMunicipality.set(municipalityID, toMunicipalityUpdateViewModel(update, authorNameById))
  }

  return lastByMunicipality
}
