/**
 * Snapshot composer for the theme/area dossiê (C190).
 *
 * Runs on the homeserver against production, read-only: the recorte IS the
 * acervo tag (`Speech.topics`), so there is no institution-style bridge and no
 * nominal match — the theme itself is the filter. Reuses the C163 speech
 * loaders (no parallel source of truth), projects out PII and returns plain
 * JSON. The render step never touches the database again.
 *
 * Integration layer, not a pure lib: it imports Payload-coupled utilities and
 * is exercised by `tests/int/themeSnapshot.int.spec.ts`.
 */

import { excerptOffsetSeconds } from '../src/lib/speechVod.ts'
import { buildSpeechListWhere } from '../src/utilities/speech/speechListFilters.ts'

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
 * Projects one speech: the official summary says what it is. There is no
 * `mentionExcerpt` here — the acervo tag is the recorte, not a literal mention.
 */
const projectSpeechRow = (doc) => ({
  id: doc.id,
  speechAt: doc.speechAt ?? null,
  type: doc.type ?? null,
  phase: doc.phase ?? null,
  summary: doc.summary ?? null,
  officialTextUrl: doc.officialTextUrl ?? null,
  youtubeUrl: doc.youtubeUrl ?? null,
  vodPlaybackUrl: doc.vodPlaybackUrl ?? null,
  youtubeExcerptStartSeconds: excerptOffsetSeconds(doc.excerptTMs, doc.eventStartAt),
  topics: Array.isArray(doc.topics) ? doc.topics : [],
})

/**
 * @param {{
 *   payload: any,
 *   actor: any,
 *   identity: { slug: string, value: string, label: string, taxonomyNote?: string | null },
 *   readAt: string,
 *   codeSha?: string | null,
 *   database?: string | null,
 * }} params
 * @returns {Promise<any>}
 */
export const composeThemeSnapshot = async ({
  payload,
  actor,
  identity,
  readAt,
  codeSha = null,
  database = null,
}) => {
  const topics = [identity.value]
  const gaps = []

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
  const docs = result.docs
  const totalCount = result.totalDocs
  if (docs.length === 0) {
    gaps.push({
      id: 'acervo_sem_falas',
      reason: `Nenhuma fala do acervo no tema ${identity.value} — o acervo cobre 2011+.`,
    })
  }

  return {
    meta: { readAt, codeSha, database, kind: 'theme' },
    theme: {
      slug: identity.slug,
      value: identity.value,
      label: identity.label,
      taxonomyNote: identity.taxonomyNote ?? 'Taxonomia do acervo',
      topics,
    },
    speeches: {
      topics,
      totalCount,
      rows: docs.map((doc) => projectSpeechRow(doc)),
    },
    gaps,
  }
}
