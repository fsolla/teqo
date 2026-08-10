/**
 * B186 — "prioridades do momento" ranking. Pure and client-safe: the AI tool
 * feeds municipality rows, per-municipality pledge recency and the in-window
 * updates, and receives the ranked priorities with one evidence line each.
 *
 * Mirrors the E9 freshness semantic (`municipalitySignal.ts`: the last signal
 * is `max(lastUpdateAt, lastPledgeAt)`) and the repo's "a class label never
 * renders alone" rule: every item carries the reason that placed it there.
 * No score number is ever computed — the buckets order by declared gravity
 * (sinal desfavorável > estagnação > potencial) and the reason is prose.
 */
import { formatElectionNumber } from '@/lib/electionFormat'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  formatEngagementLevelLabel,
  type EngagementLevel,
} from '@/lib/engagementLevel'
import {
  municipalityUpdatePolarityLabels,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import { DAY_MS } from '@/lib/text'
import { type PoliticalTrendStatus } from '@/utilities/municipality/municipalityLabels'
import {
  formatMunicipalitySignalAgeLabel,
  formatSilenceAgeLabel,
  municipalitySignalAgeInDays,
  resolveMunicipalityLastSignalAt,
} from '@/utilities/municipality/municipalitySignal'

/** Default recency window — the B185 family semantic (30 days, adjustable). */
export const PRIORITY_STALE_SIGNAL_DAYS = 30

/** How many low-engagement municipalities the potential bucket keeps per scope. */
export const PRIORITY_POTENTIAL_TOP_N = 5

/** Longest update excerpt carried into an evidence line. */
const PRIORITY_UPDATE_EXCERPT_MAX_LENGTH = 200

type MunicipalityPriorityReason = 'sinal_desfavoravel' | 'estagnacao' | 'potencial'

export type PriorityMunicipalityInput = {
  id: number
  name: string
  slug: string
  region: string | null
  city: string | null
  priority: 'alta' | 'normal'
  engagementLevel: EngagementLevel | null
  /** `expectedVotes.central` (2026 staff estimate); `null` when unset. */
  expectedVotesCentral: number | null
  /** 2022 federal valid votes (committed artifact) — the potential fallback. */
  validVotes2022: number | null
  lastUpdateAt: string | null
  politicalTrendStatus: PoliticalTrendStatus | null
}

export type PriorityUpdateSignalInput = {
  municipalityID: number
  createdAt: string
  polarity: MunicipalityUpdatePolarity
  urgent: boolean
  adversarySignal: boolean
  body: string | null
}

export type MunicipalityPriorityItem = {
  id: number
  nome: string
  slug: string
  regiao: string | null
  cidade: string | null
  motivo: MunicipalityPriorityReason
  evidencia: string
  prioridade: 'alta' | 'normal'
  nivelEngajamento: string
  ultimoSinalAtrasDias: number | null
  ultimaAtualizacao: string | null
  potencialEstimado: number | null
  fontePotencial: 'estimativa_2026' | 'validos_2022' | null
}

export type MunicipalityPriorityRankOptions = {
  windowDays: number
  /** Narrow the ranking to one reason ("só as sem atualização"). */
  reason?: MunicipalityPriorityReason
  /** Default gravity (sinal > estagnação > potencial); potential re-sorts all. */
  sortBy?: 'gravidade' | 'potencial'
  /** One clock read for the whole ranking — tests pin `agora`. */
  agora?: Date
}

type EvaluatedMunicipality = {
  input: PriorityMunicipalityInput
  lastSignalAgeDays: number | null
  decisiveUpdate: PriorityUpdateSignalInput | null
  decisiveUpdateAgeDays: number | null
  bucket: MunicipalityPriorityReason | 'excluido' | 'nada'
  potential: number | null
  potentialSource: 'estimativa_2026' | 'validos_2022' | null
}

const isLowEngagement = (level: EngagementLevel | null): boolean =>
  level === null || level === 'n0' || level === 'n1'

const potentialOf = (
  input: PriorityMunicipalityInput,
): {
  potential: number | null
  source: 'estimativa_2026' | 'validos_2022' | null
} => {
  if (input.expectedVotesCentral !== null && input.expectedVotesCentral > 0) {
    return { potential: input.expectedVotesCentral, source: 'estimativa_2026' }
  }
  if (input.validVotes2022 !== null && input.validVotes2022 > 0) {
    return { potential: input.validVotes2022, source: 'validos_2022' }
  }
  return { potential: null, source: null }
}

/** Latest update whose `createdAt` falls inside the window — "última palavra decide". */
const latestInWindowUpdate = (
  updates: PriorityUpdateSignalInput[],
  cutoff: number,
): PriorityUpdateSignalInput | null => {
  let latest: PriorityUpdateSignalInput | null = null
  for (const update of updates) {
    const createdAt = new Date(update.createdAt).getTime()
    if (Number.isNaN(createdAt) || createdAt < cutoff) continue
    if (latest === null || createdAt > new Date(latest.createdAt).getTime()) latest = update
  }
  return latest
}

const isFavorable = (update: PriorityUpdateSignalInput): boolean =>
  update.polarity === 'boa' && !update.urgent && !update.adversarySignal

const evaluateMunicipality = (
  input: PriorityMunicipalityInput,
  lastPledgeAt: string | null,
  decisiveUpdate: PriorityUpdateSignalInput | null,
  now: Date,
  windowDays: number,
): EvaluatedMunicipality => {
  const lastSignalAgeDays = municipalitySignalAgeInDays(
    resolveMunicipalityLastSignalAt(input.lastUpdateAt, lastPledgeAt),
    now,
  )
  const decisiveUpdateAgeDays = decisiveUpdate
    ? municipalitySignalAgeInDays(decisiveUpdate.createdAt, now)
    : null

  let bucket: EvaluatedMunicipality['bucket'] = 'nada'
  if (decisiveUpdate) {
    if (isFavorable(decisiveUpdate)) {
      // Acceptance rule: a municipio with a recent FAVORABLE update and no
      // negative signals is not a priority — it is excluded from every bucket,
      // the potential one included.
      bucket = 'excluido'
    } else if (
      decisiveUpdate.polarity === 'ruim' ||
      decisiveUpdate.urgent ||
      decisiveUpdate.adversarySignal
    ) {
      bucket = 'sinal_desfavoravel'
    }
  } else if (lastSignalAgeDays === null || lastSignalAgeDays >= windowDays) {
    bucket = 'estagnacao'
  }

  const { potential, source } = potentialOf(input)
  if (bucket === 'nada' && isLowEngagement(input.engagementLevel) && potential !== null) {
    bucket = 'potencial'
  }

  return {
    input,
    lastSignalAgeDays,
    decisiveUpdate,
    decisiveUpdateAgeDays,
    bucket,
    potential,
    potentialSource: source,
  }
}

const excerptOf = (body: string | null): string | null => {
  if (!body) return null
  const trimmed = body.replace(/\s+/g, ' ').trim()
  if (trimmed.length === 0) return null
  if (trimmed.length <= PRIORITY_UPDATE_EXCERPT_MAX_LENGTH) return trimmed
  return `${trimmed.slice(0, PRIORITY_UPDATE_EXCERPT_MAX_LENGTH).trimEnd()}…`
}

const engagementLevelLabel = (level: EngagementLevel | null): string =>
  level === null ? EMPTY_ENGAGEMENT_LEVEL_LABEL : formatEngagementLevelLabel(level)

const buildEvidence = (evaluated: EvaluatedMunicipality): string => {
  const { input, bucket } = evaluated
  const parts: string[] = []

  if (bucket === 'sinal_desfavoravel' && evaluated.decisiveUpdate) {
    const { decisiveUpdate, decisiveUpdateAgeDays } = evaluated
    const signalLabel = decisiveUpdate.adversarySignal
      ? `Alerta de adversário ${formatMunicipalitySignalAgeLabel(decisiveUpdateAgeDays ?? 0)}`
      : decisiveUpdate.urgent
        ? `Atualização urgente ${formatMunicipalitySignalAgeLabel(decisiveUpdateAgeDays ?? 0)}`
        : `Atualização ${municipalityUpdatePolarityLabels.ruim.toLowerCase()} ${formatMunicipalitySignalAgeLabel(decisiveUpdateAgeDays ?? 0)}`
    const excerpt = excerptOf(decisiveUpdate.body)
    parts.push(excerpt ? `${signalLabel}: "${excerpt}"` : signalLabel)
  } else if (bucket === 'estagnacao') {
    parts.push(formatSilenceAgeLabel(evaluated.lastSignalAgeDays))
  } else if (bucket === 'potencial') {
    const potentialLabel =
      evaluated.potentialSource === 'validos_2022'
        ? `${formatElectionNumber(evaluated.potential ?? 0)} válidos em 2022`
        : `estimativa central de ${formatElectionNumber(evaluated.potential ?? 0)} votos`
    const levelLabel =
      input.engagementLevel === null
        ? 'sem nível definido'
        : `nível ${formatEngagementLevelLabel(input.engagementLevel)}`
    parts.push(`Potencial alto (${potentialLabel}) e ${levelLabel}`)
  }

  if (input.priority === 'alta') parts.push('prioritário')
  if (input.politicalTrendStatus === 'desfavoravel') parts.push('tendência política desfavorável')

  return parts.join(' · ')
}

const priorityRank: Record<'alta' | 'normal', number> = { alta: 0, normal: 1 }

const bucketRank: Record<MunicipalityPriorityReason, number> = {
  sinal_desfavoravel: 0,
  estagnacao: 1,
  potencial: 2,
}

const byName = (left: PriorityMunicipalityInput, right: PriorityMunicipalityInput): number =>
  left.name.localeCompare(right.name, 'pt-BR')

const tiebreak = (left: EvaluatedMunicipality, right: EvaluatedMunicipality): number => {
  const byPriority = priorityRank[left.input.priority] - priorityRank[right.input.priority]
  if (byPriority !== 0) return byPriority
  return byName(left.input, right.input)
}

const byGravity = (left: EvaluatedMunicipality, right: EvaluatedMunicipality): number => {
  const byBucket =
    bucketRank[left.bucket as MunicipalityPriorityReason] -
    bucketRank[right.bucket as MunicipalityPriorityReason]
  if (byBucket !== 0) return byBucket

  if (left.bucket === 'sinal_desfavoravel') {
    // Most recent first: age 0 = today.
    const byAge =
      (left.decisiveUpdateAgeDays ?? Number.POSITIVE_INFINITY) -
      (right.decisiveUpdateAgeDays ?? Number.POSITIVE_INFINITY)
    if (byAge !== 0) return byAge
    return tiebreak(left, right)
  }
  if (left.bucket === 'estagnacao') {
    // Coldest first; never-signaled (+Infinity) outranks every date. The
    // explicit equality check keeps two never-signaled rows from comparing
    // Infinity - Infinity (NaN), which would silently skip the tiebreak.
    const leftAge = left.lastSignalAgeDays ?? Number.POSITIVE_INFINITY
    const rightAge = right.lastSignalAgeDays ?? Number.POSITIVE_INFINITY
    if (leftAge === rightAge) return tiebreak(left, right)
    return rightAge - leftAge
  }
  if (left.bucket === 'potencial') {
    const byPotential = (right.potential ?? 0) - (left.potential ?? 0)
    if (byPotential !== 0) return byPotential
    return tiebreak(left, right)
  }
  return tiebreak(left, right)
}

const byPotential = (left: EvaluatedMunicipality, right: EvaluatedMunicipality): number => {
  const byValue = (right.potential ?? -1) - (left.potential ?? -1)
  if (byValue !== 0) return byValue
  return tiebreak(left, right)
}

const toItem = (evaluated: EvaluatedMunicipality): MunicipalityPriorityItem => ({
  id: evaluated.input.id,
  nome: evaluated.input.name,
  slug: evaluated.input.slug,
  regiao: evaluated.input.region,
  cidade: evaluated.input.city,
  motivo: evaluated.bucket as MunicipalityPriorityReason,
  evidencia: buildEvidence(evaluated),
  prioridade: evaluated.input.priority,
  nivelEngajamento: engagementLevelLabel(evaluated.input.engagementLevel),
  // When a decisive update placed the item, its age IS the item's signal age
  // (E9 would hide it behind a null lastUpdateAt on stale rows).
  ultimoSinalAtrasDias: evaluated.decisiveUpdate
    ? evaluated.decisiveUpdateAgeDays
    : evaluated.lastSignalAgeDays,
  ultimaAtualizacao: evaluated.input.lastUpdateAt,
  potencialEstimado: evaluated.potential,
  fontePotencial: evaluated.potentialSource,
})

/**
 * Rank the scope's municipalities into "priorities of the moment". Buckets are
 * mutually exclusive and ordered by declared gravity; every returned item
 * carries the reason (evidence line) that placed it there. Municipalities with
 * a recent favorable update and no negative signals are excluded entirely.
 */
export const rankMunicipalityPriorities = (
  municipalities: PriorityMunicipalityInput[],
  lastPledgeAtById: ReadonlyMap<number, string | null>,
  updates: PriorityUpdateSignalInput[],
  options: MunicipalityPriorityRankOptions,
): MunicipalityPriorityItem[] => {
  const now = options.agora ?? new Date()
  const cutoff = now.getTime() - options.windowDays * DAY_MS

  const updatesByMunicipality = new Map<number, PriorityUpdateSignalInput[]>()
  for (const update of updates) {
    const list = updatesByMunicipality.get(update.municipalityID) ?? []
    list.push(update)
    updatesByMunicipality.set(update.municipalityID, list)
  }

  const decisiveByMunicipality = new Map<number, PriorityUpdateSignalInput>()
  for (const [municipalityID, list] of updatesByMunicipality) {
    const latest = latestInWindowUpdate(list, cutoff)
    if (latest) decisiveByMunicipality.set(municipalityID, latest)
  }

  const evaluated = municipalities.map((input) =>
    evaluateMunicipality(
      input,
      lastPledgeAtById.get(input.id) ?? null,
      decisiveByMunicipality.get(input.id) ?? null,
      now,
      options.windowDays,
    ),
  )

  // The potential bucket keeps only the top-N low-engagement municipalities of
  // the scope — a relative cut (no invented absolute threshold).
  const potentialCandidates = evaluated
    .filter((entry) => entry.bucket === 'potencial')
    .sort(
      (left, right) =>
        (right.potential ?? 0) - (left.potential ?? 0) || byName(left.input, right.input),
    )
  const topPotentialIDs = new Set(
    potentialCandidates.slice(0, PRIORITY_POTENTIAL_TOP_N).map((entry) => entry.input.id),
  )
  for (const entry of evaluated) {
    if (entry.bucket === 'potencial' && !topPotentialIDs.has(entry.input.id)) {
      entry.bucket = 'nada'
    }
  }

  const sortBy = options.sortBy === 'potencial' ? byPotential : byGravity
  const ranked = evaluated
    .filter((entry) => entry.bucket !== 'nada' && entry.bucket !== 'excluido')
    .sort(sortBy)

  if (options.reason) {
    const reason = options.reason
    return ranked.filter((entry) => entry.bucket === reason).map(toItem)
  }

  return ranked.map(toItem)
}
