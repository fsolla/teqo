'use server'

import type { Payload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  contentPieceLinkTitle,
  isContentPieceTopic,
  parseContentPieceLink,
  toContentPieceViewModel,
  type ContentPieceCuratedField,
  type ContentPieceViewModel,
} from '@/lib/contentPiece'
import { normalizeContentPiecePublicFigures } from '@/lib/publicFigureCatalog'
import {
  CONTENT_PIECE_FORBIDDEN_MESSAGE,
  CONTENT_PIECE_LINK_DUPLICATE_MESSAGE,
  CONTENT_PIECE_LINK_INVALID_MESSAGE,
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
  CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE,
  contentPieceLinkRequestSchema,
  contentPiecePublicationRequestSchema,
  contentPieceRetryRequestSchema,
  contentPieceStatusRequestSchema,
  contentPieceUpdateRequestSchema,
  type ContentPieceStatusRequest,
  type ContentPieceUpdateRequest,
} from '@/lib/schemas/contentPiece'
import type { SpeechTopic } from '@/lib/speechFacets'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { reapStaleContentPiece } from '@/utilities/content/contentPieceJob'
import {
  searchContentPieceLeaderOptions,
  type ContentPieceLeaderOption,
} from '@/utilities/content/contentPieceLeaderOptions'
import { startContentPieceJobInBackground } from '@/utilities/content/contentPieceScheduler'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C211 — mutations of the Central de Conteúdos: edit one piece's catalogue,
 * move its kill switch, add a piece by link and retry a failed processing. The
 * communication gate is repeated fresh before any read or write (same contract
 * as the acervo/cut actions); the collection access is the final barrier.
 */

const contentPieceSelect = {
  title: true,
  updatedAt: true,
  type: true,
  status: true,
  processingStatus: true,
  step: true,
  origin: true,
  topics: true,
  cityLabel: true,
  region: true,
  durationSeconds: true,
  pieceDate: true,
  publishedAt: true,
  error: true,
  linkFailureReason: true,
  media: true,
  curatedFields: true,
} as const

const loadContentPieceForActor = async (
  payload: Payload,
  actor: CampaignUser,
  contentPieceId: number,
) => {
  const result = await payload.find({
    collection: 'contentPiece',
    where: { id: { equals: contentPieceId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: contentPieceSelect,
    user: actor,
    overrideAccess: false,
  })
  return result.docs[0]
}

/**
 * Saves the ficha and records what the assessoria curated: every field the form
 * carried is added to `curatedFields`, so a running job never overwrites a
 * human decision (D6) — including an explicit clear (an empty value is a
 * decision, not an invitation to refill).
 */
export const updateContentPieceForActor = async (
  input: ContentPieceUpdateRequest,
): Promise<ContentPieceViewModel> => {
  const parsed = contentPieceUpdateRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const current = await loadContentPieceForActor(payload, actor, parsed.contentPieceId)
  if (!current) throw new Error(CONTENT_PIECE_NOT_FOUND_MESSAGE)

  const curated = new Set(current.curatedFields ?? [])
  const curatedOnSave: [ContentPieceCuratedField, boolean][] = [
    ['title', parsed.title !== undefined],
    ['description', parsed.description !== undefined],
    ['topics', parsed.topics !== undefined],
    // The request carries the relationship id; the curated vocabulary uses the
    // persisted field name.
    ['municipality', parsed.municipalityId !== undefined],
    ['institution', parsed.institution !== undefined],
    ['pieceDate', parsed.pieceDate !== undefined],
    ['transcript', parsed.transcript !== undefined],
    ['type', parsed.type !== undefined],
  ]
  for (const [field, touched] of curatedOnSave) if (touched) curated.add(field)

  const topics = (parsed.topics ?? [])
    .filter(isContentPieceTopic)
    .filter((value, index, values) => values.indexOf(value) === index) as SpeechTopic[]

  const updated = await payload.update({
    collection: 'contentPiece',
    id: parsed.contentPieceId,
    data: {
      title: parsed.title,
      type: parsed.type,
      description: parsed.description ?? null,
      pieceDate: parsed.pieceDate ?? null,
      topics,
      municipality: parsed.municipalityId ?? null,
      institution: parsed.institution ?? null,
      transcript: parsed.transcript ?? null,
      leaders: parsed.leaderIds ?? [],
      publicFigures: normalizeContentPiecePublicFigures(parsed.publicFigures ?? []),
      curatedFields: [...curated],
    },
    depth: 0,
    select: contentPieceSelect,
    user: actor,
    overrideAccess: false,
  })

  return toContentPieceViewModel(updated)
}

/**
 * The kill switch: `publicado` puts the piece on the public Central (the first
 * publication generates its canonical slug inside the transaction), `rascunho`
 * takes it off at once and preserves slug, `publishedAt` and file.
 */
export const setContentPiecePublishedForActor = async (input: {
  contentPieceId: number
  published: boolean
}): Promise<ContentPieceViewModel> => {
  const parsed = contentPiecePublicationRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const current = await loadContentPieceForActor(payload, actor, parsed.contentPieceId)
  if (!current) throw new Error(CONTENT_PIECE_NOT_FOUND_MESSAGE)

  const updated = await withPayloadTransaction(payload, async ({ req }) =>
    payload.update({
      collection: 'contentPiece',
      id: parsed.contentPieceId,
      data: { status: parsed.published ? 'publicado' : 'rascunho' },
      depth: 0,
      select: contentPieceSelect,
      user: actor,
      overrideAccess: false,
      req,
    }),
  )

  return toContentPieceViewModel(updated)
}

/** Retries the processing of a failed piece (same row, same job). */
export const retryContentPieceForActor = async (input: {
  contentPieceId: number
}): Promise<ContentPieceViewModel> => {
  const parsed = contentPieceRetryRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const current = await loadContentPieceForActor(payload, actor, parsed.contentPieceId)
  if (!current) throw new Error(CONTENT_PIECE_NOT_FOUND_MESSAGE)
  if (current.processingStatus !== 'falhou') throw new Error(CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE)

  // Conditional update: two concurrent retries cannot both schedule a job.
  const updated = await payload.update({
    collection: 'contentPiece',
    where: {
      and: [{ id: { equals: parsed.contentPieceId } }, { processingStatus: { equals: 'falhou' } }],
    },
    data: {
      processingStatus: 'processando',
      step: 'extraindo',
      error: null,
      linkFailureReason: null,
    },
    depth: 0,
    select: contentPieceSelect,
    user: actor,
    overrideAccess: false,
  })
  const piece = updated.docs[0]
  if (!piece) throw new Error(CONTENT_PIECE_RETRY_NOT_FAILED_MESSAGE)

  startContentPieceJobInBackground(piece.id)
  return toContentPieceViewModel(piece)
}

/**
 * Polls the statuses of the visible pieces; a stale `processando` row is reaped
 * to `falhou` on the way (there is no queue to ask), then the page is read
 * fresh so the returned status is the repaired one.
 */
export const getContentPieceStatusesForActor = async (
  input: ContentPieceStatusRequest,
): Promise<ContentPieceViewModel[]> => {
  const parsed = contentPieceStatusRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const where = { id: { in: parsed.contentPieceIds } }
  const first = await payload.find({
    collection: 'contentPiece',
    where,
    depth: 0,
    limit: parsed.contentPieceIds.length,
    pagination: false,
    select: contentPieceSelect,
    user: actor,
    overrideAccess: false,
  })

  await Promise.all(
    first.docs.map((piece) =>
      reapStaleContentPiece(payload, {
        id: piece.id,
        processingStatus: piece.processingStatus,
        updatedAt: piece.updatedAt,
      }),
    ),
  )

  const result = await payload.find({
    collection: 'contentPiece',
    where,
    depth: 0,
    limit: parsed.contentPieceIds.length,
    pagination: false,
    select: contentPieceSelect,
    user: actor,
    overrideAccess: false,
  })
  return result.docs.map((piece) => toContentPieceViewModel(piece))
}

/**
 * Adds a piece by link: the canonical URL is the identity (unique in the DB), so
 * pasting the same post twice answers the same domain message instead of
 * creating a twin row. The pipeline resolves the official extraction in the
 * background; a link without an official path becomes a peça-link.
 */
export const addContentPieceByLinkForActor = async (input: {
  url: string
}): Promise<ContentPieceViewModel> => {
  const parsed = contentPieceLinkRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const link = parseContentPieceLink(parsed.url)
  if (!link) throw new Error(CONTENT_PIECE_LINK_INVALID_MESSAGE)

  const existing = await payload.find({
    collection: 'contentPiece',
    where: { sourceUrl: { equals: link.canonicalUrl } },
    depth: 0,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
  })
  if (existing.docs[0]) throw new Error(CONTENT_PIECE_LINK_DUPLICATE_MESSAGE)

  try {
    // A link is catalogued as a video piece; the extraction reclassifies an
    // Instagram image to `foto` and the assessoria can change the type.
    const piece = await payload.create({
      collection: 'contentPiece',
      data: {
        title: contentPieceLinkTitle(link),
        type: 'video',
        origin: link.origin,
        sourceUrl: link.canonicalUrl,
        status: 'rascunho',
        processingStatus: 'processando',
        step: 'extraindo',
      },
      depth: 0,
      user: actor,
      overrideAccess: false,
    })

    startContentPieceJobInBackground(piece.id)
    return toContentPieceViewModel(piece)
  } catch (error) {
    // A concurrent paste can still hit the unique index; it is the same
    // duplicate the probe above answers, so it maps to the same message.
    if (
      error instanceof Error &&
      /source_url|sourceUrl|duplicate key|unique/i.test(error.message)
    ) {
      throw new Error(CONTENT_PIECE_LINK_DUPLICATE_MESSAGE)
    }
    throw error
  }
}

/**
 * S37 — the ficha's leader picker search. Same communication gate as every
 * action of the vertical; the returned options carry ONLY `{ id, label }` (the
 * display-name projection the int tests assert), never any other leadership
 * field.
 */
export const searchContentPieceLeaderOptionsForActor = async (
  query: string,
): Promise<ContentPieceLeaderOption[]> => {
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  return searchContentPieceLeaderOptions(payload, actor, query)
}
