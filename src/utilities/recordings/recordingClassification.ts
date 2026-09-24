import 'server-only'

import type { Payload } from 'payload'

import type { MergedSpeechFacets, SpeechScope, SpeechTopic } from '@/lib/speechFacets'
import type { SpeechFacetInput } from '@/lib/speechGazetteer'
import type { Recording } from '@/payload-types'
import {
  classifySpeech,
  type SpeechClassificationResult,
} from '@/utilities/speech/speechClassifier'

/**
 * C219 — facet classification of one uploaded recording. Reuses the speech
 * classifier owner (`classifySpeech`: gazetteer + validated LLM refinement)
 * over the transcript the job already has in memory, so recordings gain the
 * same topic/scope/município facets with the same provenance vocabulary. The
 * classifier never throws; this wrapper is also defensive (empty transcript or
 * a database failure resolve to `null`) because the recording must still
 * become `ready` with its transcript.
 */

export type RecordingFacetClassifier = (
  input: SpeechFacetInput,
) => Promise<SpeechClassificationResult>

export type RecordingClassification = {
  topics: SpeechTopic[]
  scopes: SpeechScope[]
  classifiedBy: MergedSpeechFacets['classifiedBy']
  mentionedMunicipalities: number[]
  /** Provider usage of the refinement pass; the backfill CLI reports it. */
  llm: SpeechClassificationResult['llm']
}

/**
 * The facet write shape, shared by the two writers (the job and the backfill
 * CLI) so a new facet field lands in one place.
 */
export const recordingFacetWriteData = (
  classification: RecordingClassification,
): Pick<Recording, 'topics' | 'scopes' | 'classifiedBy' | 'mentionedMunicipalities'> => ({
  topics: classification.topics,
  scopes: classification.scopes,
  classifiedBy: classification.classifiedBy,
  mentionedMunicipalities: classification.mentionedMunicipalities,
})

export const classifyRecordingFacets = async ({
  payload,
  transcript,
  classify = classifySpeech,
}: {
  payload: Pick<Payload, 'find' | 'logger'>
  transcript: string
  classify?: RecordingFacetClassifier
}): Promise<RecordingClassification | null> => {
  const text = transcript.trim()
  if (!text) return null

  try {
    const { facets, llm } = await classify({ transcript: text })

    const slugs = [...new Set(facets.municipalities.map((entry) => entry.slug))]
    const municipalities =
      slugs.length === 0
        ? []
        : (
            await payload.find({
              collection: 'municipality',
              where: { slug: { in: slugs } },
              limit: slugs.length,
              depth: 0,
              select: { slug: true },
              // Intentional admin bypass: resolving gazetteer slugs against the
              // read-only município catalog (same as the speech import).
              overrideAccess: true,
            })
          ).docs

    return {
      topics: facets.topics,
      scopes: facets.scopes,
      classifiedBy: facets.classifiedBy,
      mentionedMunicipalities: municipalities.map((doc) => doc.id),
      llm,
    }
  } catch (error) {
    // Defensive: the classifier contract is "never throws"; a database failure
    // while resolving the gazetteer slugs lands here. The recording still gets
    // its transcript — but the failure is logged instead of vanishing.
    payload.logger.warn(
      `[recording-classification] falha ao classificar: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}
