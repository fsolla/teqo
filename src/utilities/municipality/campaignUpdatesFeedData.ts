import 'server-only'

import type { Payload } from 'payload'

import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  municipalityUpdatePolarities,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser, MunicipalityUpdate } from '@/payload-types'
import {
  loadCampaignUserDisplayByIds,
  loadCampaignUserNamesByIds,
  loadMunicipalityLabelsByIds,
} from '@/utilities/loadNamesByIds'
import {
  buildCampaignUpdatesFeedWhere,
  campaignUpdatesFeedPageSize,
  type CampaignUpdatesFeedState,
} from '@/utilities/municipality/municipalityUpdateListUrl'

export type CampaignUpdatesFeedCard = {
  id: number
  body: string | null
  polarity: MunicipalityUpdatePolarity
  urgent: boolean
  /**
   * Shown to every feed reader without a read-side role check. Safe because
   * the page gate is `staff` and `canReadMunicipalityUpdate` denies leaders
   * outright — no lesser-privileged reader exists yet. Re-check before any
   * non-staff surface reuses the loader.
   */
  adversarySignal: boolean
  createdAt: string
  author: { id: number; name: string; avatarUrl: string | null }
  municipality: { id: number; name: string; slug: string }
}

export type CampaignUpdatesFeedFacets = {
  /**
   * Municipalities the actor may filter by / create updates in — the whole
   * portfolio (advisor: administered; unrestricted: all 435). Carries both id
   * (create combobox value) and slug (omnibox seed; labels come from the
   * catalog on the client).
   */
  municipalities: Array<{ id: number; slug: string }>
  /** "Quem criou" options: distinct authors present in the actor's scope. */
  authorOptions: Array<{ value: string; label: string }>
}

/**
 * The C89 feed query runs with `overrideAccess: false` and NO municipality
 * clause: `canReadMunicipalityUpdate` (scoped read) restricts the result to
 * the actor's portfolio — advisor → administered municipalities, unrestricted →
 * everything, leader → nothing. The page's `gate: 'staff'` keeps leaders out.
 * The municipality filter, when present, goes through the relationship's own
 * `slug` field (dotted path) so an out-of-scope slug returns zero rows.
 */
export const loadCampaignUpdatesFeed = async (
  payload: Payload,
  user: CampaignUser,
  state: CampaignUpdatesFeedState,
): Promise<{
  cards: CampaignUpdatesFeedCard[]
  totalDocs: number
  totalPages: number
  page: number
}> => {
  const result = await payload.find({
    collection: 'municipalityUpdate',
    where: buildCampaignUpdatesFeedWhere(state),
    depth: 0,
    limit: campaignUpdatesFeedPageSize,
    page: state.page,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  const authorIDs = uniqueRelationshipIds(result.docs.map((update) => update.author))
  const municipalityIDs = uniqueRelationshipIds(result.docs.map((update) => update.municipality))
  const [authorDisplayById, municipalityLabelsById] = await Promise.all([
    loadCampaignUserDisplayByIds(payload, authorIDs),
    loadMunicipalityLabelsByIds(payload, municipalityIDs),
  ])

  const cards = result.docs.map((update): CampaignUpdatesFeedCard => {
    const doc = update as MunicipalityUpdate
    const authorID = relationshipId(doc.author) ?? 0
    const municipalityID = relationshipId(doc.municipality) ?? 0
    const author = authorDisplayById.get(authorID)
    const municipality = municipalityLabelsById.get(municipalityID)
    const polarity = doc.polarity as MunicipalityUpdatePolarity | undefined

    return {
      id: doc.id,
      body: doc.body ?? null,
      polarity: polarity && municipalityUpdatePolarities.includes(polarity) ? polarity : 'neutra',
      urgent: Boolean(doc.urgent),
      adversarySignal: Boolean(doc.adversarySignal),
      createdAt: doc.createdAt,
      author: { id: authorID, name: author?.name ?? 'Usuário', avatarUrl: author?.avatarUrl ?? null },
      municipality: municipality
        ? { id: municipalityID, name: municipality.name, slug: municipality.slug }
        : { id: municipalityID, name: 'Município', slug: '' },
    }
  })

  return {
    cards,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? state.page,
  }
}

/** Options for the feed omnibox and create form, scoped to the actor's portfolio. */
export const loadCampaignUpdatesFeedFacets = async (
  payload: Payload,
  user: CampaignUser,
): Promise<CampaignUpdatesFeedFacets> => {
  const [municipalityResult, authorResult] = await Promise.all([
    payload.find({
      collection: 'municipality',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { id: true, slug: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'municipalityUpdate',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { author: true },
      user,
      overrideAccess: false,
    }),
  ])

  const municipalities = municipalityResult.docs
    .map(({ id, slug }) => ({ id, slug }))
    .sort((left, right) => left.slug.localeCompare(right.slug, 'pt-BR'))

  const authorIDs = uniqueRelationshipIds(authorResult.docs.map((doc) => doc.author))
  const authorNameById = await loadCampaignUserNamesByIds(payload, authorIDs)

  return {
    municipalities,
    authorOptions: authorIDs
      .map((id) => ({ id, name: authorNameById.get(id) ?? `Pessoa #${id}` }))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      .map(({ id, name }) => ({ value: String(id), label: name })),
  }
}
