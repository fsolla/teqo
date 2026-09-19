/**
 * C200 — pure speaker-grouping rules of an uploaded recording. The diarization
 * provider returns anonymous turns (acoustic clusters); this module assigns
 * each transcript segment to the turn it overlaps and numbers the clusters
 * globally by first appearance. Identification is human: nothing here matches a
 * voice to a person — the labels are text the team types.
 *
 * No I/O and no `server-only`: the job, the view models and the unit tests
 * share this module. `reconcileSpeakerLabels` is the reprocessing contract: a
 * new run cannot re-associate a voice (no biometrics), so a label survives only
 * when an old cluster maps 1:1 to a new one by time overlap; the rest is
 * reported as dropped so the detail can warn instead of silently forgetting.
 */

/** One anonymous speaker turn as the provider returns it, in absolute seconds. */
export type DiarizedTurn = {
  speaker: string
  startSeconds: number
  endSeconds: number
}

/** A segment with the cluster key it was assigned to; null if no turn covers it. */
export type SpeakerKeyed = {
  speakerKey: string | null
}

/** A label the team typed for one cluster key of one recording. */
export type RecordingSpeakerLabel = {
  speakerKey: string
  label: string
}

/** A span used by the alignment/reconciliation math (segment or cluster). */
export type TimedSpan = {
  startSeconds: number
  endSeconds: number
}

/**
 * Overlap in seconds between two spans; zero when they do not touch. A
 * degenerate span (end before start) is clamped to its start, never negative.
 */
const overlapSeconds = (a: TimedSpan, b: TimedSpan): number =>
  Math.max(0, Math.min(a.endSeconds, b.endSeconds) - Math.max(a.startSeconds, b.startSeconds))

/** Gap in seconds between two spans; zero when they overlap or touch. */
const gapSeconds = (a: TimedSpan, b: TimedSpan): number =>
  Math.max(0, Math.max(a.startSeconds, b.startSeconds) - Math.min(a.endSeconds, b.endSeconds))

/** Closest boundary distance used to break overlap ties by midpoint proximity. */
const midpointDistance = (a: TimedSpan, b: TimedSpan): number =>
  Math.abs((a.startSeconds + a.endSeconds) / 2 - (b.startSeconds + b.endSeconds) / 2)

/**
 * Picks the turn of one segment: the largest overlap wins, ties go to the turn
 * whose midpoint sits closest to the segment's, and a segment that overlaps no
 * turn at all falls back to the nearest turn by gap (the audio is contiguous,
 * so an isolated segment belongs to the closest voice). Invalid turns are
 * ignored by the caller.
 */
const pickTurn = (segment: TimedSpan, turns: readonly DiarizedTurn[]): number => {
  let best = -1
  let bestOverlap = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const [turnIndex, turn] of turns.entries()) {
    const overlap = overlapSeconds(segment, turn)
    const distance = midpointDistance(segment, turn)
    const wins =
      overlap > bestOverlap || (overlap > 0 && overlap === bestOverlap && distance < bestDistance)
    if (wins) {
      best = turnIndex
      bestOverlap = overlap
      bestDistance = distance
    }
  }
  if (bestOverlap > 0) return best

  let nearest = 0
  let nearestGap = Number.POSITIVE_INFINITY
  for (const [turnIndex, turn] of turns.entries()) {
    const gap = gapSeconds(segment, turn)
    if (gap < nearestGap) {
      nearest = turnIndex
      nearestGap = gap
    }
  }
  return nearest
}

/**
 * Assigns each segment a `speaker-N` key following the acoustic turns. The
 * numbering is global to the recording and follows the first appearance of the
 * cluster in segment order — two runs over the same audio produce the same
 * keys, and a segment with no usable turn keeps a null key (the detail renders
 * the plain transcript then). Pure: tests do not touch the provider.
 */
export const assignSpeakerKeys = <Segment extends TimedSpan>(
  segments: readonly Segment[],
  turns: readonly DiarizedTurn[],
): (Segment & SpeakerKeyed)[] => {
  const validTurns = turns.filter(
    (turn) =>
      typeof turn.speaker === 'string' &&
      turn.speaker.length > 0 &&
      Number.isFinite(turn.startSeconds) &&
      Number.isFinite(turn.endSeconds),
  )
  if (validTurns.length === 0) {
    return segments.map((segment) => ({ ...segment, speakerKey: null }))
  }

  const clusterKeys = new Map<string, string>()
  const keyOfTurn = (turn: DiarizedTurn): string => {
    const existing = clusterKeys.get(turn.speaker)
    if (existing) return existing
    const key = `speaker-${clusterKeys.size + 1}`
    clusterKeys.set(turn.speaker, key)
    return key
  }

  return segments.map((segment) => {
    const turn = validTurns[pickTurn(segment, validTurns)]
    return { ...segment, speakerKey: turn ? keyOfTurn(turn) : null }
  })
}

/** First-appearance order of the keys in a keyed segment list. */
export const speakerKeysInOrder = (segments: readonly SpeakerKeyed[]): string[] => {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const segment of segments) {
    if (!segment.speakerKey || seen.has(segment.speakerKey)) continue
    seen.add(segment.speakerKey)
    keys.push(segment.speakerKey)
  }
  return keys
}

/**
 * Reprocessing contract (D6): a previous label is kept only on a mutual 1:1
 * time-overlap match — one old cluster maps to exactly one new cluster and that
 * new cluster receives exactly one old label. A split (one old cluster became
 * two) or a merge (two old clusters became one) is uncertainty, so the affected
 * labels are dropped and reported instead of naming the wrong voice. Output
 * labels follow the new segment order.
 */
export const reconcileSpeakerLabels = ({
  previousLabels,
  previousSegments,
  nextSegments,
}: {
  previousLabels: readonly RecordingSpeakerLabel[]
  previousSegments: readonly (TimedSpan & SpeakerKeyed)[]
  nextSegments: readonly (TimedSpan & SpeakerKeyed)[]
}): { labels: RecordingSpeakerLabel[]; dropped: boolean } => {
  if (previousLabels.length === 0) return { labels: [], dropped: false }

  const nextKeys = speakerKeysInOrder(nextSegments)
  if (nextKeys.length === 0) return { labels: [], dropped: true }

  const previousKeys = speakerKeysInOrder(previousSegments)
  const overlapByPair = new Map<string, number>()
  for (const previous of previousSegments) {
    if (!previous.speakerKey) continue
    for (const next of nextSegments) {
      if (!next.speakerKey) continue
      const pair = `${previous.speakerKey}\u0000${next.speakerKey}`
      overlapByPair.set(pair, (overlapByPair.get(pair) ?? 0) + overlapSeconds(previous, next))
    }
  }

  const labelByPreviousKey = new Map(previousLabels.map((entry) => [entry.speakerKey, entry.label]))
  const claimantsOfNextKey = (nextKey: string): string[] =>
    previousKeys.filter(
      (previousKey) => (overlapByPair.get(`${previousKey}\u0000${nextKey}`) ?? 0) > 0,
    )

  const kept = new Map<string, string>()
  for (const nextKey of nextKeys) {
    const claimants = claimantsOfNextKey(nextKey)
    const [previousKey] = claimants
    if (claimants.length !== 1 || !previousKey) continue
    const label = labelByPreviousKey.get(previousKey)
    if (!label) continue
    // Mutual uniqueness: the same old cluster must not also map elsewhere.
    const matchesOfPrevious = nextKeys.filter(
      (candidate) => (overlapByPair.get(`${previousKey}\u0000${candidate}`) ?? 0) > 0,
    )
    if (matchesOfPrevious.length !== 1) continue
    kept.set(nextKey, label)
  }

  const labels = [...kept.entries()].map(([speakerKey, label]) => ({ speakerKey, label }))
  return { labels, dropped: previousLabels.length > labels.length }
}

/**
 * Distinct labels of a recording, case-insensitive and trimmed — the
 * denormalized `speakerNames` used by the "Pessoa" facet. Order of first
 * appearance; empty labels never count.
 */
export const speakerNamesFromLabels = (
  labels: readonly RecordingSpeakerLabel[] | null | undefined,
): string[] => {
  const names: string[] = []
  const seen = new Set<string>()
  for (const entry of labels ?? []) {
    const name = typeof entry?.label === 'string' ? entry.label.trim() : ''
    if (!name) continue
    const folded = foldSpeakerName(name)
    if (seen.has(folded)) continue
    seen.add(folded)
    names.push(name)
  }
  return names
}

/** The default public name of one cluster: always numbered, never a person. */
export const recordingSpeakerDefaultLabel = (index: number): string => `Falante ${index}`

/**
 * Case-fold used by every speaker-name comparison: the facet query is
 * case-insensitive (ILIKE), so parsing, dedupe and chip matching share ONE
 * fold to never disagree.
 */
export const foldSpeakerName = (value: string): string => value.toLocaleLowerCase('pt-BR')

/**
 * Case-insensitive containment of one selected "Pessoa" term in one label —
 * the same match the facet query runs (`contains` → ILIKE), so the card chip
 * and the result set never disagree.
 */
export const speakerNameMatches = (name: string, filter: string): boolean =>
  foldSpeakerName(name).includes(foldSpeakerName(filter))

/**
 * Provider ceiling for one diarization call (AssemblyAI accepts up to 10 h per
 * file). Longer recordings skip the step and keep the honest single-block
 * transcript instead of guessing speakers.
 */
export const RECORDING_DIARIZATION_MAX_SECONDS = 10 * 60 * 60
