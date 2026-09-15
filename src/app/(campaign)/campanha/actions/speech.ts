'use server'

import type { Payload } from 'payload'

import { canReadSpeechCatalog } from '@/lib/campaignRoles'
import {
  SPEECH_CUT_FORBIDDEN_MESSAGE,
  SPEECH_CUT_INVALID_RANGE_MESSAGE,
  SPEECH_CUT_NOT_FOUND_MESSAGE,
  SPEECH_CUT_PUBLISH_NOT_READY_MESSAGE,
  SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE,
  SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE,
  speechCutPublicationRequestSchema,
  speechCutRequestSchema,
  speechCutStatusRequestSchema,
  speechCutSuggestionRequestSchema,
  speechCutTextUpdateRequestSchema,
  type SpeechCutPublicationRequest,
  type SpeechCutRequest,
  type SpeechCutTextUpdateRequest,
} from '@/lib/schemas/speechCut'
import {
  SPEECH_VOD_FORBIDDEN_MESSAGE,
  SPEECH_VOD_INELIGIBLE_MESSAGE,
  SPEECH_VOD_NOT_FOUND_MESSAGE,
  speechVodRequestSchema,
} from '@/lib/schemas/speechVod'
import { formatSpeechDate } from '@/lib/speechClock'
import { toSpeechCutViewModel, type SpeechCutViewModel } from '@/lib/speechCut'
import {
  MAX_EXCERPT_SECONDS,
  MIN_EXCERPT_SECONDS,
  normalizeExcerptRange,
} from '@/lib/speechExcerptSelection'
import { speechVodCoordinates, type SpeechVodResolution } from '@/lib/speechVod'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { findSpeechCutForActor as loadSpeechCutForActor } from '@/utilities/speech/speechCutData'
import { reapStaleSpeechCut } from '@/utilities/speech/speechCutJob'
import {
  suggestSpeechCutMetadata,
  type SpeechCutMetadataSuggestion,
} from '@/utilities/speech/speechCutMetadata'
import { startSpeechCutJobInBackground } from '@/utilities/speech/speechCutScheduler'
import { resolveSpeechVod } from '@/utilities/speech/speechVodResolver'

/**
 * C162 — resolves the exact excerpt MP4 for one speech through the Câmara
 * `video-sob-demanda` endpoint. The catalog gate is checked BEFORE the read so
 * a denied actor gets the domain message (the read itself runs with
 * `overrideAccess: false` and would only yield "not found"). The stored VOD
 * link is an eligibility signal, never a URL handed to the client: the
 * resolution owns the truth, and the response only carries probed links.
 */
export const resolveSpeechVodForActor = async (input: {
  speechId: number
}): Promise<SpeechVodResolution> => {
  const { speechId } = speechVodRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_VOD_FORBIDDEN_MESSAGE)

  const result = await payload.find({
    collection: 'speech',
    where: { id: { equals: speechId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: {
      eventId: true,
      audioId: true,
      excerptTMs: true,
      vodPlaybackUrl: true,
      vodDownloadUrl: true,
    },
    user: actor,
    overrideAccess: false,
  })
  const speech = result.docs[0]
  if (!speech) throw new Error(SPEECH_VOD_NOT_FOUND_MESSAGE)

  const coordinates = speechVodCoordinates(speech)
  if (!coordinates) throw new Error(SPEECH_VOD_INELIGIBLE_MESSAGE)

  return resolveSpeechVod(coordinates)
}

// ---------------------------------------------------------------------------
// C167 — cuts: create/retry the exact [start, end] MP4, poll it and suggest
// the AI metadata. The catalog gate is repeated here, fresh, before any read or
// write (same contract as the C162 resolution above).
// ---------------------------------------------------------------------------

const speechCutSpeechSelect = {
  speechAt: true,
  type: true,
  summary: true,
  durationSeconds: true,
  vodPlaybackUrl: true,
  vodDownloadUrl: true,
  eventId: true,
  audioId: true,
  excerptTMs: true,
} as const

const loadSpeechForCut = async (payload: Payload, actor: CampaignUser, speechId: number) => {
  const result = await payload.find({
    collection: 'speech',
    where: { id: { equals: speechId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: speechCutSpeechSelect,
    user: actor,
    overrideAccess: false,
  })
  return result.docs[0] ?? null
}

/**
 * Validates the requested window against the C166 bounds and the speech
 * duration, then normalizes it. Deterministic (the action and the suggestion
 * must agree): a forged request fails closed instead of silently cutting a
 * different interval.
 */
const resolveExcerptRange = (
  durationSeconds: number | null | undefined,
  startSeconds: number,
  endSeconds: number,
): { startSeconds: number; endSeconds: number } => {
  const duration = Math.floor(durationSeconds ?? 0)
  const requested = endSeconds - startSeconds
  if (requested < MIN_EXCERPT_SECONDS || requested > MAX_EXCERPT_SECONDS || endSeconds > duration) {
    throw new Error(SPEECH_CUT_INVALID_RANGE_MESSAGE)
  }
  const range = normalizeExcerptRange(startSeconds, endSeconds, duration)
  if (!range) throw new Error(SPEECH_CUT_INVALID_RANGE_MESSAGE)
  return range
}

const createSpeechCut = async (
  payload: Payload,
  actor: CampaignUser,
  input: {
    speechId: number
    startSeconds: number
    endSeconds: number
    title: string
    description: string
  },
): Promise<SpeechCutViewModel> => {
  const speech = await loadSpeechForCut(payload, actor, input.speechId)
  if (!speech) throw new Error(SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE)
  if (!speechVodCoordinates(speech)) throw new Error(SPEECH_VOD_INELIGIBLE_MESSAGE)

  const range = resolveExcerptRange(speech.durationSeconds, input.startSeconds, input.endSeconds)

  // Dedupe in-flight: a double click or a retried POST gets the same row (and
  // the same public id) instead of two cuts of one excerpt.
  const inFlight = await payload.find({
    collection: 'speechCut',
    where: {
      and: [
        { createdBy: { equals: actor.id } },
        { speech: { equals: speech.id } },
        { startSeconds: { equals: range.startSeconds } },
        { endSeconds: { equals: range.endSeconds } },
        { status: { equals: 'processing' } },
      ],
    },
    depth: 1,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
  })
  const existing = inFlight.docs[0]
  if (existing) return toSpeechCutViewModel(existing)

  const cut = await payload.create({
    collection: 'speechCut',
    data: {
      speech: speech.id,
      startSeconds: range.startSeconds,
      endSeconds: range.endSeconds,
      durationSeconds: range.endSeconds - range.startSeconds,
      title: input.title,
      description: input.description,
      status: 'processing',
      step: 'resolving',
    },
    depth: 1,
    user: actor,
    overrideAccess: false,
  })
  startSpeechCutJobInBackground(cut.id)
  return toSpeechCutViewModel(cut)
}

const retrySpeechCut = async (
  payload: Payload,
  actor: CampaignUser,
  cutId: number,
): Promise<SpeechCutViewModel> => {
  const current = await loadSpeechCutForActor(payload, actor, cutId)
  if (!current) throw new Error(SPEECH_CUT_NOT_FOUND_MESSAGE)
  if (current.status !== 'failed') throw new Error(SPEECH_CUT_RETRY_NOT_FAILED_MESSAGE)

  const cut = await payload.update({
    collection: 'speechCut',
    id: cutId,
    data: { status: 'processing', step: 'resolving', error: null, media: null, publishedAt: null },
    depth: 1,
    user: actor,
    overrideAccess: false,
  })
  startSpeechCutJobInBackground(cut.id)
  return toSpeechCutViewModel(cut)
}

/**
 * Creates one cut (`speechId` + range + title/description) or retries the
 * failed row (`retryOf`) — the dialog reuses the selection and never duplicates
 * a cut on retry.
 */
export const saveSpeechCutForActor = async (
  input: SpeechCutRequest,
): Promise<SpeechCutViewModel> => {
  const parsed = speechCutRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_CUT_FORBIDDEN_MESSAGE)

  return 'retryOf' in parsed
    ? retrySpeechCut(payload, actor, parsed.retryOf)
    : createSpeechCut(payload, actor, parsed)
}

/** Polls one cut; a stale `processing` row is reaped to `failed` on the way. */
export const getSpeechCutStatusForActor = async (input: {
  cutId: number
}): Promise<SpeechCutViewModel> => {
  const { cutId } = speechCutStatusRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_CUT_FORBIDDEN_MESSAGE)

  let cut = await loadSpeechCutForActor(payload, actor, cutId)
  if (!cut) throw new Error(SPEECH_CUT_NOT_FOUND_MESSAGE)

  if (
    await reapStaleSpeechCut(payload, {
      id: cut.id,
      status: cut.status,
      updatedAt: cut.updatedAt ?? '',
    })
  ) {
    cut = await loadSpeechCutForActor(payload, actor, cutId)
    if (!cut) throw new Error(SPEECH_CUT_NOT_FOUND_MESSAGE)
  }

  return toSpeechCutViewModel(cut)
}

// ---------------------------------------------------------------------------
// C168 — the cut library: edit the cut's own text and toggle the public link.
// Same fresh `speechCatalog` gate as the C167 mutations; the collection access
// (canReadSpeech) and the whitelisted zod payload are the field boundary.
// ---------------------------------------------------------------------------

/** Edits the cut's title/description — never the source speech nor the video. */
export const updateSpeechCutTextForActor = async (
  input: SpeechCutTextUpdateRequest,
): Promise<SpeechCutViewModel> => {
  const parsed = speechCutTextUpdateRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_CUT_FORBIDDEN_MESSAGE)

  const current = await loadSpeechCutForActor(payload, actor, parsed.cutId)
  if (!current) throw new Error(SPEECH_CUT_NOT_FOUND_MESSAGE)

  const cut = await payload.update({
    collection: 'speechCut',
    id: parsed.cutId,
    data: { title: parsed.title, description: parsed.description },
    depth: 1,
    user: actor,
    overrideAccess: false,
  })
  return toSpeechCutViewModel(cut)
}

/**
 * Kill switch: `published` restores the same public `/corte/<id>` link
 * (`publishedAt` stamps the new publication); `unpublished` only takes it off
 * the air — the row, the file and the id stay. Refused until the MP4 exists.
 */
export const setSpeechCutPublishedForActor = async (
  input: SpeechCutPublicationRequest,
): Promise<SpeechCutViewModel> => {
  const parsed = speechCutPublicationRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_CUT_FORBIDDEN_MESSAGE)

  const current = await loadSpeechCutForActor(payload, actor, parsed.cutId)
  if (!current) throw new Error(SPEECH_CUT_NOT_FOUND_MESSAGE)
  if (parsed.published && !current.media) throw new Error(SPEECH_CUT_PUBLISH_NOT_READY_MESSAGE)

  const cut = await payload.update({
    collection: 'speechCut',
    id: parsed.cutId,
    data: parsed.published
      ? { status: 'published', publishedAt: new Date().toISOString() }
      : { status: 'unpublished' },
    depth: 1,
    user: actor,
    overrideAccess: false,
  })
  return toSpeechCutViewModel(cut)
}

/** AI suggestion for the picked window; falls back deterministically, never blocks. */
export const suggestSpeechCutMetadataForActor = async (input: {
  speechId: number
  startSeconds: number
  endSeconds: number
}): Promise<SpeechCutMetadataSuggestion> => {
  const parsed = speechCutSuggestionRequestSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()

  if (!canReadSpeechCatalog(actor.role)) throw new Error(SPEECH_CUT_FORBIDDEN_MESSAGE)

  const speech = await loadSpeechForCut(payload, actor, parsed.speechId)
  if (!speech) throw new Error(SPEECH_CUT_SPEECH_NOT_FOUND_MESSAGE)

  const range = resolveExcerptRange(speech.durationSeconds, parsed.startSeconds, parsed.endSeconds)

  const segments = await payload.find({
    collection: 'speechSegment',
    where: {
      and: [
        { speech: { equals: speech.id } },
        { endSeconds: { greater_than: range.startSeconds } },
        { startSeconds: { less_than: range.endSeconds } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    select: { startSeconds: true, endSeconds: true, text: true },
    user: actor,
    overrideAccess: false,
  })

  return suggestSpeechCutMetadata({
    speechType: speech.type ?? null,
    dateLabel: formatSpeechDate(speech.speechAt),
    summary: speech.summary ?? null,
    segments: segments.docs.map((segment) => ({
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      text: segment.text,
    })),
    startSeconds: range.startSeconds,
    endSeconds: range.endSeconds,
  })
}
