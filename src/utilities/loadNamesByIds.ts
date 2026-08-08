import 'server-only'

import type { Payload } from 'payload'

import { mediaDocumentUrl } from '@/utilities/campaignUserProfile'

/**
 * Display-name resolution by id set (Pass 3 P3-E). The "resolve names for rows
 * the actor already passed row-level access on" pattern used to be re-spelled
 * in seven loaders — including one that lost its row type to
 * `Record<string, unknown>`.
 *
 * Intentional admin bypass, justified ONCE here: the ids come from documents
 * the actor was already authorized to read (they are relationship fields of
 * those documents), so resolving their display names discloses nothing the
 * authorized read did not. Every call below is fully typed against its literal
 * collection slug — no DynamicFind cast.
 */

export const loadCampaignUserNamesByIds = async (
  payload: Pick<Payload, 'find'>,
  ids: readonly number[],
): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'campaignUser',
    where: { id: { in: [...ids] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })
  return new Map(result.docs.map((doc) => [doc.id, doc.name]))
}

/**
 * Campaign user id → `{ name, avatarUrl }` for surfaces that render an author
 * avatar (C89 updates feed). Same justified admin bypass as
 * `loadCampaignUserNamesByIds`; the avatar relationship is populated at depth 1
 * so `mediaDocumentUrl` can resolve the media url.
 */
export const loadCampaignUserDisplayByIds = async (
  payload: Pick<Payload, 'find'>,
  ids: readonly number[],
): Promise<Map<number, { name: string; avatarUrl: string | null }>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'campaignUser',
    where: { id: { in: [...ids] } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: { name: true, avatar: true },
    overrideAccess: true,
  })
  return new Map(
    result.docs.map((doc) => [
      doc.id,
      { name: doc.name, avatarUrl: mediaDocumentUrl(doc.avatar) },
    ]),
  )
}

/** Municipality id → `{ name, slug }` — both travel together on every list/detail label. */
export const loadMunicipalityLabelsByIds = async (
  payload: Pick<Payload, 'find'>,
  ids: readonly number[],
): Promise<Map<number, { name: string; slug: string }>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'municipality',
    where: { id: { in: [...ids] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true, slug: true },
    overrideAccess: true,
  })
  return new Map(result.docs.map((doc) => [doc.id, { name: doc.name, slug: doc.slug }]))
}

export const loadOrganizationNamesByIds = async (
  payload: Pick<Payload, 'find'>,
  ids: readonly number[],
): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'organization',
    where: { id: { in: [...ids] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })
  return new Map(result.docs.map((doc) => [doc.id, doc.name]))
}

/**
 * Leadership id → contact display name (depth-1 populate). Returns only the
 * names actually resolved — each caller keeps its own fallback copy
 * ("Contato" / "Liderança"), which is display policy, not data.
 */
export const loadLeadershipContactNamesByIds = async (
  payload: Pick<Payload, 'find'>,
  ids: readonly number[],
): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'leadership',
    where: { id: { in: [...ids] } },
    depth: 1,
    limit: 0,
    pagination: false,
    select: { contact: true },
    overrideAccess: true,
  })
  const names = new Map<number, string>()
  for (const doc of result.docs) {
    const contact = doc.contact
    if (typeof contact === 'object' && contact !== null && 'name' in contact) {
      names.set(doc.id, String(contact.name))
    }
  }
  return names
}
