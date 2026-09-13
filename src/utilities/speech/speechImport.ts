import 'server-only'

import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import type { MergedSpeechFacets } from '@/lib/speechFacets'
import { normalizeForSearch } from '@/lib/speechSearch'
import type { Speech } from '@/payload-types'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * Idempotent persistence of one imported speech (C153). Identity is
 * `sourceKey`; metadata is refreshed on every run, segments are replaced only
 * when the caller supplies them, and a `manual` facet curation is never
 * overwritten. Everything runs in one transaction on the Payload session.
 */

type SpeechSegmentInput = {
  startSeconds: number
  endSeconds: number
  text: string
}

export type SpeechImportBundle = {
  sourceKey: string
  speechAt: string
  year: number | null
  legislature: Speech['legislature']
  type: string | null
  phase: string | null
  durationSeconds: number | null
  summary: string | null
  officialTranscript: string | null
  officialTextUrl: string | null
  keywords: string[]
  eventId: number | null
  eventType: string | null
  eventStartAt: string | null
  eventEndAt: string | null
  youtubeUrl: string | null
  presidingOfficer: string | null
  audioId: number | null
  excerptTMs: number | null
  vodPlaybackUrl: string | null
  vodDownloadUrl: string | null
  /** Undefined preserves the stored facets (e.g. a run that skipped classification). */
  facets?: MergedSpeechFacets
  /** Undefined preserves the stored segments (e.g. `--skip-transcribe`). */
  segments?: SpeechSegmentInput[]
}

export type SpeechImportState = {
  id: number
  audioId: number | null
  excerptTMs: number | null
  segmentCount: number
  classifiedBy: Speech['classifiedBy']
  durationSeconds: number | null
  vodPlaybackUrl: string | null
  vodDownloadUrl: string | null
  summary: string | null
  officialTranscript: string | null
}

export type SpeechUpsertCounts = {
  created: boolean
  segmentsInserted: number
  segmentsDeleted: number
  manualFacetsPreserved: boolean
}

/** Current stored state of one speech, for the importer's skip decisions. */
export const findSpeechImportState = async (
  payload: Payload,
  sourceKey: string,
): Promise<SpeechImportState | null> => {
  const found = await payload.find({
    collection: 'speech',
    where: { sourceKey: { equals: sourceKey } },
    limit: 1,
    depth: 0,
    select: {
      audioId: true,
      excerptTMs: true,
      classifiedBy: true,
      durationSeconds: true,
      vodPlaybackUrl: true,
      vodDownloadUrl: true,
      summary: true,
      officialTranscript: true,
    },
    // Intentional bypass: the import CLI is a trusted actor with no session.
    overrideAccess: true,
  })
  const speech = found.docs[0]
  if (!speech) return null

  const segments = await payload.count({
    collection: 'speechSegment',
    where: { speech: { equals: speech.id } },
    // Intentional bypass: the import CLI is a trusted actor with no session.
    overrideAccess: true,
  })

  return {
    id: speech.id,
    audioId: speech.audioId ?? null,
    excerptTMs: speech.excerptTMs ?? null,
    segmentCount: segments.totalDocs,
    classifiedBy: speech.classifiedBy,
    durationSeconds: speech.durationSeconds ?? null,
    vodPlaybackUrl: speech.vodPlaybackUrl ?? null,
    vodDownloadUrl: speech.vodDownloadUrl ?? null,
    summary: speech.summary ?? null,
    officialTranscript: speech.officialTranscript ?? null,
  }
}

type SpeechWriteData = RequiredDataFromCollectionSlug<'speech'>

const metadataData = (
  bundle: SpeechImportBundle,
): Omit<SpeechWriteData, 'sourceKey' | 'classifiedBy' | 'searchText'> => ({
  speechAt: bundle.speechAt,
  year: bundle.year,
  legislature: bundle.legislature,
  type: bundle.type,
  phase: bundle.phase,
  durationSeconds: bundle.durationSeconds,
  summary: bundle.summary,
  officialTranscript: bundle.officialTranscript,
  officialTextUrl: bundle.officialTextUrl,
  keywords: bundle.keywords,
  eventId: bundle.eventId,
  eventType: bundle.eventType,
  eventStartAt: bundle.eventStartAt,
  eventEndAt: bundle.eventEndAt,
  youtubeUrl: bundle.youtubeUrl,
  presidingOfficer: bundle.presidingOfficer,
  audioId: bundle.audioId,
  excerptTMs: bundle.excerptTMs,
  vodPlaybackUrl: bundle.vodPlaybackUrl,
  vodDownloadUrl: bundle.vodDownloadUrl,
})

export const upsertSpeechBundle = async (
  payload: Payload,
  bundle: SpeechImportBundle,
): Promise<SpeechUpsertCounts> =>
  withPayloadTransaction(payload, async ({ req }) => {
    const found = await payload.find({
      collection: 'speech',
      where: { sourceKey: { equals: bundle.sourceKey } },
      limit: 1,
      depth: 0,
      select: { id: true, classifiedBy: true },
      req,
      // Intentional bypass: the import CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    const current = found.docs[0]
    const manualFacetsPreserved = current?.classifiedBy === 'manual'

    // C154 — the speech-level search text mirrors the segments and is owned by
    // this bundle: `segments: undefined` (skip/ASR failure) preserves whatever
    // is stored, exactly like the segments themselves.
    const segmentSearchText =
      bundle.segments === undefined
        ? undefined
        : normalizeForSearch(bundle.segments.map((segment) => segment.text).join(' '))

    const metadata = metadataData(bundle)
    const facets: Partial<SpeechWriteData> = {}
    if (bundle.facets && !manualFacetsPreserved) {
      const municipalitySlugs = bundle.facets.municipalities.map((entry) => entry.slug)
      const municipalities =
        municipalitySlugs.length === 0
          ? []
          : (
              await payload.find({
                collection: 'municipality',
                where: { slug: { in: municipalitySlugs } },
                limit: municipalitySlugs.length,
                depth: 0,
                select: { slug: true },
                req,
                // Intentional bypass: resolving gazetteer slugs inside the import transaction.
                overrideAccess: true,
              })
            ).docs
      facets.topics = bundle.facets.topics
      facets.scopes = bundle.facets.scopes
      facets.classifiedBy = bundle.facets.classifiedBy
      facets.mentionedMunicipalities = municipalities.map((doc) => doc.id)
      facets.mentionedPeople = bundle.facets.people
      facets.mentionedPrograms = bundle.facets.programs
      facets.mentionedProjects = bundle.facets.projects
    }
    const data = { ...metadata, ...facets }

    let speechId: number
    let created = false
    if (current) {
      await payload.update({
        collection: 'speech',
        id: current.id,
        data: segmentSearchText === undefined ? data : { ...data, searchText: segmentSearchText },
        depth: 0,
        req,
        // Intentional bypass: the import CLI is a trusted actor with no session.
        overrideAccess: true,
      })
      speechId = current.id
    } else {
      const speech = await payload.create({
        collection: 'speech',
        data: {
          sourceKey: bundle.sourceKey,
          classifiedBy: bundle.facets?.classifiedBy ?? 'gazetteer',
          searchText: segmentSearchText ?? '',
          ...data,
        },
        depth: 0,
        req,
        // Intentional bypass: the import CLI is a trusted actor with no session.
        overrideAccess: true,
      })
      speechId = speech.id
      created = true
    }

    let segmentsInserted = 0
    let segmentsDeleted = 0
    if (bundle.segments !== undefined) {
      const removed = await payload.delete({
        collection: 'speechSegment',
        where: { speech: { equals: speechId } },
        req,
        // Intentional bypass: replacing segments owned by the speech being imported.
        overrideAccess: true,
      })
      segmentsDeleted = removed.docs.length

      for (const [index, segment] of bundle.segments.entries()) {
        await payload.create({
          collection: 'speechSegment',
          data: {
            speech: speechId,
            order: index + 1,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            text: segment.text,
            searchText: normalizeForSearch(segment.text),
          },
          req,
          // Intentional bypass: the import CLI is a trusted actor with no session.
          overrideAccess: true,
        })
        segmentsInserted += 1
      }
    }

    return { created, segmentsInserted, segmentsDeleted, manualFacetsPreserved }
  })
