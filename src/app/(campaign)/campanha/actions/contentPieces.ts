'use server'

import type { Payload } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import {
  CONTENT_MEDIA_SLUG,
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
  contentPieceDeleteRequestSchema,
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
import {
  contentPieceExistsForPostIdentity,
  isContentPieceSourceUrlDuplicateError,
} from '@/utilities/content/contentPieceLink'
import {
  createContentPieceFromProfilePost,
  listContentPieceProfileImportCandidates,
  type ContentPieceProfileImportListing,
  type ContentPieceProfileImportOutcome,
} from '@/utilities/content/contentPieceProfileImport'
import { startContentPieceJobInBackground } from '@/utilities/content/contentPieceScheduler'
import { onPayloadTransactionCommit, withPayloadTransaction } from '@/utilities/payloadTransaction'

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
 * C222 — hard-deletes one piece: the row goes inside the transaction (the
 * collection access is the final barrier); the private media row is removed
 * after commit, best-effort, so a storage hiccup cannot fail the delete the
 * person asked for (same shape as the C199 recording delete). The media id is
 * read from the doc the delete returned — reading it in the delete itself
 * closes the window in which the pipeline could have attached a file between a
 * pre-read and the commit. Deleting a `processando` row is deliberate: it is
 * how the assessoria cancels a stuck piece, and the job tolerates the row
 * disappearing.
 */
export const deleteContentPieceForActor = async (input: {
  contentPieceId: number
}): Promise<{ deleted: true }> => {
  const parsed = contentPieceDeleteRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const current = await loadContentPieceForActor(payload, actor, parsed.contentPieceId)
  if (!current) throw new Error(CONTENT_PIECE_NOT_FOUND_MESSAGE)

  await withPayloadTransaction(payload, async ({ transactionID, req }) => {
    const deleted = await payload.delete({
      collection: 'contentPiece',
      id: parsed.contentPieceId,
      depth: 0,
      select: { media: true },
      user: actor,
      overrideAccess: false,
      req,
    })

    const mediaId = typeof deleted.media === 'number' ? deleted.media : (deleted.media?.id ?? null)
    if (mediaId !== null) {
      onPayloadTransactionCommit(transactionID, () => {
        void payload
          .delete({
            collection: CONTENT_MEDIA_SLUG,
            id: mediaId,
            // Intentional admin bypass: cleanup of the file that belonged to
            // the piece this actor was authorized to delete.
            overrideAccess: true,
          })
          .catch(() => undefined)
      })
    }
  })

  return { deleted: true }
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

  // The post's identity, not the URL spelling: pasting `/p/ABC/` answers the
  // same duplicate as `/reel/ABC/` (C230 shares this probe with the importer).
  if (await contentPieceExistsForPostIdentity({ payload, actor, link })) {
    throw new Error(CONTENT_PIECE_LINK_DUPLICATE_MESSAGE)
  }

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
    if (isContentPieceSourceUrlDuplicateError(error)) {
      throw new Error(CONTENT_PIECE_LINK_DUPLICATE_MESSAGE)
    }
    throw error
  }
}

/**
 * C230 — lists the novelties of the official profile: the feed is read with
 * the global's credential (fail-closed) and each post is checked against the
 * Central by the identity of the post, never by the URL spelling. The listing
 * persists nothing; the confirmation creates the pieces one by one.
 */
export const listContentPieceProfileImportCandidatesForActor =
  async (): Promise<ContentPieceProfileImportListing> => {
    const { payload, actor } = await getCampaignActionContext()

    if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

    return listContentPieceProfileImportCandidates({ payload, actor })
  }

/**
 * C230 — creates ONE draft from ONE listed media through the C220 pipeline
 * (`existing` covers a repeated/concurrent import). The dialog calls it per
 * candidate so one failure never stops the others.
 */
export const createContentPieceFromProfilePostForActor = async (input: {
  url: string
}): Promise<{ outcome: ContentPieceProfileImportOutcome }> => {
  const parsed = contentPieceLinkRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadCommunicationCatalog(actor.role)) throw new Error(CONTENT_PIECE_FORBIDDEN_MESSAGE)

  const outcome = await createContentPieceFromProfilePost({ payload, actor, url: parsed.url })
  return { outcome }
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
