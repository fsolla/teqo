import {
  formatBahiaCivilDate,
  formatCivilDateLabel,
  parseBahiaDateTimeInput,
} from '@/lib/campaignTime'
import {
  contentPiecePostIdentityUrls,
  contentPieceProfileCandidateFromPost,
  parseContentPieceLink,
  type ContentPieceProfileLinkOnlyReason,
  type ContentPieceProfilePost,
} from '@/lib/contentPiece'

/**
 * C235 — the publication window of the profile import: the pure owner of the
 * recency filter (each post timestamp against the civil Bahia dates the
 * operator typed), the identity dedupe (the feed against the Central in any
 * URL spelling and against itself) and the honest coverage check that tells
 * when the official API did not reach the requested start. No I/O and no
 * `server-only`: the server importer and the ops CLI both read this, and the
 * unit specs pin the policy without Payload.
 */

/** The window the operator chose: the default recency slice or a civil period. */
export type ContentPieceProfileWindow =
  | { mode: 'recent' }
  | { mode: 'period'; since: string; until?: string | null }

/** The feed post the window filter needs: the shared metadata + its timestamp. */
export type ContentPieceProfileWindowPost = ContentPieceProfilePost & { timestamp: string }

type ContentPieceProfileWindowCandidate = {
  url: string
  shortcode: string
  linkOnlyReason: ContentPieceProfileLinkOnlyReason | null
  timestamp: string
  mediaType: string
}

export type ContentPieceProfileWindowPlan = {
  /** The bounds actually applied; null means unbounded on that side. */
  window: { from: string | null; to: string | null }
  /** Parseable posts inside the window: candidates + already catalogued + feed twins. */
  found: number
  existingCount: number
  existingShortcodes: string[]
  feedDuplicates: number
  malformed: number
  outsideWindow: number
  /** The novelties, in feed order (newest first). */
  candidates: ContentPieceProfileWindowCandidate[]
}

/**
 * Above this many novelties the confirmation warns that a large batch of
 * drafts will be created at once (design scene 03). One feed page is the unit
 * the operator already sees in the recency import.
 */
export const CONTENT_PIECE_PROFILE_IMPORT_LARGE_WINDOW_THRESHOLD = 50

type CivilDateCheck = { since: string; until?: string | null }

/** Exact civil-round-trip: a syntactically valid but impossible date fails. */
const isRealCivilDate = (value: string): boolean => {
  const instantIso = parseBahiaDateTimeInput(`${value}T00:00`)
  return instantIso !== null && formatBahiaCivilDate(new Date(instantIso)) === value
}

/**
 * The domain message of an invalid period window, or null when it is valid.
 * `today` is a civil Bahia date so the future check is stable and testable.
 */
export const contentPieceProfilePeriodError = ({
  since,
  until,
  today,
}: CivilDateCheck & { today: string }): string | null => {
  if (!isRealCivilDate(since)) return 'Informe uma data inicial válida.'
  if (until && !isRealCivilDate(until)) return 'Informe uma data final válida.'
  if (until && until < since) return 'A data final não pode ser anterior à data inicial.'
  if (since > today) return 'A data inicial não pode estar no futuro.'
  return null
}

/**
 * The instants of the chosen period: the start of the `since` civil day and
 * the exclusive end of the `until` civil day (Bahia is UTC-3 all year round,
 * so the next civil midnight is a fixed 24h later). An absent `until` is
 * open-ended — the feed runs to today.
 */
export const contentPieceProfilePeriodBounds = ({
  since,
  until,
}: CivilDateCheck): { fromIso: string; toIso: string | null } => {
  const fromIso = isRealCivilDate(since) ? parseBahiaDateTimeInput(`${since}T00:00`) : null
  if (!fromIso) throw new Error('Informe uma data inicial válida.')

  if (!until) return { fromIso, toIso: null }

  const untilStart = isRealCivilDate(until) ? parseBahiaDateTimeInput(`${until}T00:00`) : null
  if (!untilStart) throw new Error('Informe uma data final válida.')
  return { fromIso, toIso: new Date(Date.parse(untilStart) + 86_400_000).toISOString() }
}

/**
 * True when the walk went past the start of the window (the feed is
 * newest-first, so a post older than `fromIso` proves the window start was
 * reached). A null bound means unbounded — always reached. The check is
 * conservative on purpose: a profile whose whole history sits inside the
 * window is reported as not reached, which only makes the receipt more
 * cautious, never less honest.
 */
export const contentPieceProfileWindowStartReached = ({
  posts,
  fromIso,
}: {
  posts: readonly ContentPieceProfileWindowPost[]
  fromIso: string | null
}): boolean => {
  if (fromIso === null) return true
  const fromMs = Date.parse(fromIso)
  return posts.some((post) => Date.parse(post.timestamp) < fromMs)
}

/** The pt-BR label of the chosen window ("01/08/2026 → hoje"). */
export const contentPieceProfileWindowLabel = (window: ContentPieceProfileWindow): string => {
  if (window.mode === 'recent') return 'Recentes'
  const from = formatCivilDateLabel(window.since)
  return `${from} → ${window.until ? formatCivilDateLabel(window.until) : 'hoje'}`
}

/**
 * The identity URLs of every parseable post of the feed — what the dedupe
 * query asks the Central for in `sourceUrl in` lookups. A permalink the
 * catalogue cannot parse contributes nothing (it never becomes a candidate).
 */
export const contentPieceProfileFeedIdentityUrls = (
  posts: readonly ContentPieceProfileWindowPost[],
): string[] => {
  const urls = new Set<string>()
  for (const post of posts) {
    const candidate = contentPieceProfileCandidateFromPost(post)
    if (!candidate) continue
    const link = parseContentPieceLink(candidate.url)
    if (!link) continue
    for (const url of contentPiecePostIdentityUrls(link)) urls.add(url)
  }
  return [...urls]
}

/**
 * Filters the feed to the chosen window and splits it into novelties, pieces
 * the Central already had and posts that cannot be imported (outside the
 * window, unparseable permalink or a repeated identity inside the feed).
 * Candidates keep the feed order (newest first). The bounds are optional:
 * without them the whole feed is the window (the recency import).
 *
 * `found` counts the parseable posts inside the window: candidates + already
 * catalogued + repeated identities.
 */
export const planContentPieceProfileWindow = ({
  posts,
  existingSourceUrls = [],
  from = null,
  to = null,
}: {
  posts: readonly ContentPieceProfileWindowPost[]
  existingSourceUrls?: readonly string[]
  from?: string | null
  to?: string | null
}): ContentPieceProfileWindowPlan => {
  const fromMs = from === null ? null : Date.parse(from)
  const toMs = to === null ? null : Date.parse(to)
  if ((fromMs !== null && !Number.isFinite(fromMs)) || (toMs !== null && !Number.isFinite(toMs))) {
    throw new Error('janela inválida: from/to precisam ser instantes ISO ou null.')
  }

  const existing = new Set(existingSourceUrls)
  const seen = new Set<string>()
  const candidates: ContentPieceProfileWindowCandidate[] = []
  const existingShortcodes: string[] = []
  let outsideWindow = 0
  let malformed = 0
  let feedDuplicates = 0

  for (const post of posts) {
    const timestamp = Date.parse(post.timestamp)
    if (!Number.isFinite(timestamp)) {
      // An item without a usable timestamp cannot be placed in any window.
      malformed += 1
      continue
    }
    if ((fromMs !== null && timestamp < fromMs) || (toMs !== null && timestamp > toMs)) {
      outsideWindow += 1
      continue
    }

    const candidate = contentPieceProfileCandidateFromPost(post)
    const link = candidate ? parseContentPieceLink(candidate.url) : null
    if (!candidate || !link) {
      malformed += 1
      continue
    }

    const identityUrls = contentPiecePostIdentityUrls(link)
    const shortcode = link.origin === 'instagram' ? link.shortcode : link.videoId
    if (identityUrls.some((url) => existing.has(url))) {
      existingShortcodes.push(shortcode)
      continue
    }
    if (identityUrls.some((url) => seen.has(url))) {
      feedDuplicates += 1
      continue
    }
    identityUrls.forEach((url) => seen.add(url))
    candidates.push({
      url: candidate.url,
      shortcode,
      linkOnlyReason: candidate.linkOnlyReason,
      timestamp: post.timestamp,
      mediaType: post.mediaType,
    })
  }

  return {
    window: { from, to },
    found: candidates.length + existingShortcodes.length + feedDuplicates,
    existingCount: existingShortcodes.length,
    existingShortcodes,
    feedDuplicates,
    malformed,
    outsideWindow,
    candidates,
  }
}
