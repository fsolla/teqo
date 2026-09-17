/**
 * Snapshot composer for the institutional dossiê (C187).
 *
 * Runs on the homeserver against production, read-only: the institutional
 * recorte does not exist as a relationship on `speech`, so the bridge is
 * theme→institution (`identity.topics`, from the catalog). Reuses the C163
 * speech loaders (no parallel source of truth), projects out PII and returns
 * plain JSON. The render step never touches the database again.
 *
 * Integration layer, not a pure lib: it imports Payload-coupled utilities and
 * is exercised by `tests/int/institutionSnapshot.int.spec.ts`.
 */

import { normalizeForSearch } from '../src/lib/speechSearch.ts'
import { excerptOffsetSeconds } from '../src/lib/speechVod.ts'
import { buildSpeechListWhere } from '../src/utilities/speech/speechListFilters.ts'
import { loadSegmentsForSpeeches } from '../src/utilities/speech/speechPageData.ts'

const SPEECH_LIMIT = 15

const SPEECH_SELECT = {
  speechAt: true,
  type: true,
  phase: true,
  summary: true,
  officialTextUrl: true,
  youtubeUrl: true,
  vodPlaybackUrl: true,
  excerptTMs: true,
  eventStartAt: true,
  topics: true,
}

/**
 * Projects one speech: the official summary says what it is; `mentionExcerpt`
 * is the passage that literally names the institution (null when the acervo tag
 * has no literal mention in the ASR segments).
 */
const projectSpeechRow = (doc, segments, matchNames) => {
  const candidates = matchNames
    .map((name) => ({ name, key: normalizeForSearch(name) }))
    .filter((candidate) => candidate.key)
  const matched = candidates.find(({ key }) =>
    segments.some((segment) => normalizeForSearch(segment.text).includes(key)),
  )
  const mentionSegment = matched
    ? segments.find((segment) => normalizeForSearch(segment.text).includes(matched.key))
    : undefined
  return {
    id: doc.id,
    speechAt: doc.speechAt ?? null,
    type: doc.type ?? null,
    phase: doc.phase ?? null,
    summary: doc.summary ?? null,
    officialTextUrl: doc.officialTextUrl ?? null,
    youtubeUrl: doc.youtubeUrl ?? null,
    vodPlaybackUrl: doc.vodPlaybackUrl ?? null,
    youtubeExcerptStartSeconds: excerptOffsetSeconds(doc.excerptTMs, doc.eventStartAt),
    mentionExcerpt: mentionSegment?.text ?? null,
    matchedName: matched?.name ?? null,
    topics: Array.isArray(doc.topics) ? doc.topics : [],
  }
}

/**
 * @param {{
 *   payload: any,
 *   actor: any,
 *   identity: { slug: string, name: string, kind: string, kindLabel: string, sphere: string, sphereLabel: string, scope: string, scopeLabel: string, aliases: string[], topics: string[] },
 *   readAt: string,
 *   codeSha?: string | null,
 *   database?: string | null,
 * }} params
 * @returns {Promise<any>}
 */
export const composeInstitutionSnapshot = async ({
  payload,
  actor,
  identity,
  readAt,
  codeSha = null,
  database = null,
}) => {
  const topics = Array.isArray(identity.topics) ? identity.topics : []
  const matchNames = [identity.name, ...(identity.aliases ?? [])]

  let docs = []
  let totalCount = 0
  const gaps = []
  if (topics.length === 0) {
    gaps.push({
      id: 'acervo_sem_tema',
      reason: 'A instituição não declara temas no catálogo — o recorte do acervo fica vazio.',
    })
  } else {
    const result = await payload.find({
      collection: 'speech',
      where: buildSpeechListWhere({ page: 1, topics }),
      depth: 0,
      limit: SPEECH_LIMIT,
      sort: '-speechAt',
      select: SPEECH_SELECT,
      user: actor,
      overrideAccess: false,
    })
    docs = result.docs
    totalCount = result.totalDocs
    if (docs.length === 0) {
      gaps.push({
        id: 'acervo_sem_falas',
        reason: `Nenhuma fala do acervo nos temas ${topics.join(', ')} — o acervo cobre 2011+.`,
      })
    }
  }

  const segmentsBySpeech = await loadSegmentsForSpeeches(
    payload,
    actor,
    docs.map((doc) => doc.id),
  )

  return {
    meta: { readAt, codeSha, database, kind: 'institution' },
    institution: {
      slug: identity.slug,
      name: identity.name,
      kind: identity.kind,
      kindLabel: identity.kindLabel,
      sphere: identity.sphere,
      sphereLabel: identity.sphereLabel,
      scope: identity.scope,
      scopeLabel: identity.scopeLabel,
      aliases: identity.aliases ?? [],
      topics,
    },
    speeches: {
      topics,
      totalCount,
      rows: docs.map((doc) =>
        projectSpeechRow(doc, segmentsBySpeech.get(doc.id) ?? [], matchNames),
      ),
    },
    gaps,
  }
}
