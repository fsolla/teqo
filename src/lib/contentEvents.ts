/**
 * C213 — the anonymous content-event vocabulary and the public beacon.
 *
 * One mechanism for every content subject: `subjectType` says what the event
 * happened to (`peca` today; `card` is the additive extension of S32) and
 * `subjectId` is that subject's stable key. The event carries NOTHING about the
 * visitor — no IP, no cookie, no user-agent, no session — and the beacon below
 * is fire-and-forget by contract: it never throws, never blocks and never
 * delays the public page, the download or the share (fail-soft).
 *
 * Pure and client-safe: the public route's zod schema and the client
 * components import the same vocabulary, so a new event type is one edit.
 */

import type { CardModelId } from '@/lib/cardModels'

export const CONTENT_EVENT_ENDPOINT = '/api/content-events'

export const CONTENT_EVENT_TYPES = [
  'abertura',
  'download',
  'compartilhar_whatsapp',
  'compartilhar_link',
] as const

export type ContentEventType = (typeof CONTENT_EVENT_TYPES)[number]

/** Admin/REST labels only — the public surfaces own their own copy. */
export const contentEventTypeLabels: Record<ContentEventType, string> = {
  abertura: 'Abertura da peça',
  download: 'Download',
  compartilhar_whatsapp: 'Clique em compartilhar (WhatsApp)',
  compartilhar_link: 'Clique em compartilhar (link)',
}

export const isContentEventType = (value: unknown): value is ContentEventType =>
  typeof value === 'string' && (CONTENT_EVENT_TYPES as readonly string[]).includes(value)

export const CONTENT_EVENT_SUBJECT_TYPES = ['peca', 'card'] as const

export type ContentEventSubjectType = (typeof CONTENT_EVENT_SUBJECT_TYPES)[number]

export const contentEventSubjectTypeLabels: Record<ContentEventSubjectType, string> = {
  peca: 'Peça',
  card: 'Card',
}

export const isContentEventSubjectType = (value: unknown): value is ContentEventSubjectType =>
  typeof value === 'string' && (CONTENT_EVENT_SUBJECT_TYPES as readonly string[]).includes(value)

/**
 * One grouped row of the anonymous-event aggregate, as the SQL reader returns
 * it and any subject-specific mapper consumes it. Generic on purpose: the same
 * shape serves the piece counters today and the card counters of S32.
 */
export type ContentEventAggregateRow = {
  subjectId: string
  type: string
  count: number
}

type ContentEventBeaconBody = {
  type: ContentEventType
  pieceSlug: string
}

type CardDownloadBeaconBody = {
  type: 'download'
  subjectType: 'card'
  cardModelId: CardModelId
  stateDeputySlug?: string
}

/**
 * Sends one anonymous event body and forgets it. `sendBeacon` survives the
 * navigation a click is about to trigger (the WhatsApp tab, the download);
 * `fetch` with `keepalive` is the fallback for browsers without it. Every
 * branch is swallowed: a lost count is acceptable, a broken action is not.
 */
const postContentEventBody = (body: string): void => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(
        CONTENT_EVENT_ENDPOINT,
        new Blob([body], { type: 'application/json' }),
      )
      if (sent) return
    }
  } catch {
    // Fall through to the fetch fallback.
  }

  try {
    void fetch(CONTENT_EVENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Fail-soft: the public action never depends on the count.
  }
}

/** One anonymous event of a published piece (C213). */
export const sendContentPieceEvent = (type: ContentEventType, pieceSlug: string): void => {
  const body: ContentEventBeaconBody = { type, pieceSlug }
  postContentEventBody(JSON.stringify(body))
}

/**
 * S32 — one anonymous download event of a personalized card: the model id (the
 * public catalog key) and, on the models with a state-deputy picker, the slug
 * of the chosen state deputy. Same transport and same fail-soft contract as the
 * piece beacon: it never throws and never delays the download.
 */
export const sendCardDownloadEvent = (
  modelId: CardModelId,
  stateDeputySlug?: string | null,
): void => {
  const body: CardDownloadBeaconBody = {
    type: 'download',
    subjectType: 'card',
    cardModelId: modelId,
  }
  if (stateDeputySlug) body.stateDeputySlug = stateDeputySlug

  postContentEventBody(JSON.stringify(body))
}
