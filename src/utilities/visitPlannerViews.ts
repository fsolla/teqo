import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { ActivityKind } from '@/lib/schemas/activity'
import type { CalendarPhase } from '@/lib/visitPlannerAnchors'
import type { MunicipalityGoalCoverage } from '@/utilities/goalCoverage'
import type { MunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'
import type { VisitEligibility } from '@/utilities/visitEligibility'

/**
 * E13 view models and tour composition — the client-safe contract side of
 * `visitPlannerData.ts` (which owns the Payload reads and is `server-only`),
 * same split as `votePledgeViews` vs `votePledgeData`.
 */

export type VisitCandidateViewModel = {
  id: number
  slug: string
  name: string
  region: BahiaIdentityTerritory
  priority: 'alta' | 'normal' | null
  eligibility: VisitEligibility
  /** Fixed to the `central` scenario, like the E8 card on the detail page. */
  coverage: MunicipalityGoalCoverage
  territorialClass: MunicipalityTerritorialClass
  leadershipCount: number
  pledgeCount: number
  advisorCount: number
}

export type VisitCandidateGroupViewModel = {
  region: BahiaIdentityTerritory
  candidates: VisitCandidateViewModel[]
}

export type VisitPlannerBundle = {
  phase: CalendarPhase
  groups: VisitCandidateGroupViewModel[]
}

/**
 * Ordering of the queue: how many of the five conditions a município clears
 * first, then how many votes are still missing from its goal. Deliberately not
 * a weighted sum of the two — the checklist is a gate, the deficit is the
 * tiebreak inside a gate level.
 */
export const compareVisitCandidates = (
  left: VisitCandidateViewModel,
  right: VisitCandidateViewModel,
): number =>
  right.eligibility.metCount - left.eligibility.metCount ||
  right.coverage.deficit - left.coverage.deficit ||
  left.name.localeCompare(right.name, 'pt-BR')

/** Somewhere the candidate could actually be received. */
const hasNetwork = (candidate: VisitCandidateViewModel): boolean =>
  candidate.leadershipCount >= 1 || candidate.pledgeCount >= 1

/** A giro is a day or two: an anchor, a few satellites, one bet. */
export const TOUR_MAX_SATELLITES = 3

export type TourSuggestion = {
  /** Município with the largest committed stock — the act that justifies the trip. */
  anchorSlug: string | null
  satelliteSlugs: string[]
  /** One expansão município: P12's "semente" — a bet, not a repeat. */
  seedSlug: string | null
}

/**
 * J-C composition: âncora + satélites + 1 semente, inside ONE identity
 * territory. The anchor is where the committed vote already is (the act has an
 * audience), the satellites are the next best stops that have someone to
 * receive, and the seed is deliberately a município he is weak in — without it
 * every giro repeats the base and the campaign never expands (P12). The seed
 * still needs a network: a bet on a place with nobody to receive the candidate
 * is not a bet, it is a wasted day (research report §6.7).
 *
 * The result is a SUGGESTION: the composer renders it pre-selected and the
 * coordination edits it before generating anything.
 */
export const composeTourSuggestion = (
  candidates: ReadonlyArray<VisitCandidateViewModel>,
): TourSuggestion => {
  const receivable = candidates.filter(hasNetwork)

  const anchor = receivable.reduce<VisitCandidateViewModel | null>((best, candidate) => {
    if (!best) return candidate
    if (candidate.coverage.committed > best.coverage.committed) return candidate
    if (candidate.coverage.committed < best.coverage.committed) return best
    return candidate.coverage.goal > best.coverage.goal ? candidate : best
  }, null)

  // The seed is reserved BEFORE the satellites are filled. Picking it from the
  // leftovers meant a territory with four good stops produced a giro that only
  // repeated the base — the satellites had eaten every slot.
  const seed =
    receivable
      .filter(
        (candidate) => candidate.territorialClass === 'expansao' && candidate.slug !== anchor?.slug,
      )
      .sort((left, right) => right.coverage.deficit - left.coverage.deficit)[0] ?? null

  const satellites = receivable
    .filter((candidate) => candidate.slug !== anchor?.slug && candidate.slug !== seed?.slug)
    .sort(compareVisitCandidates)
    .slice(0, TOUR_MAX_SATELLITES)

  return {
    anchorSlug: anchor?.slug ?? null,
    satelliteSlugs: satellites.map((candidate) => candidate.slug),
    seedSlug: seed?.slug ?? null,
  }
}

/** Every slug the suggestion pre-selects, in tour reading order. */
export const tourSuggestionSlugs = (suggestion: TourSuggestion): string[] => [
  ...(suggestion.anchorSlug ? [suggestion.anchorSlug] : []),
  ...suggestion.satelliteSlugs,
  ...(suggestion.seedSlug ? [suggestion.seedSlug] : []),
]

export type TourStopRole = 'ancora' | 'satelite' | 'semente'

export const tourStopRoleLabels: Record<TourStopRole, string> = {
  ancora: 'Âncora',
  satelite: 'Satélite',
  semente: 'Semente',
}

/**
 * What each role is for, in the words the coordination uses — rendered next to
 * the stop so the composition is auditable instead of magic.
 */
export const tourStopRoleDescriptions: Record<TourStopRole, string> = {
  ancora: 'Maior estoque de votos comprometidos do território: é o ato que justifica a viagem.',
  satelite: 'Parada com rede para receber, no caminho do mesmo território.',
  semente: 'Município de expansão: aposta de crescimento, para o giro não repetir só a base.',
}

export const resolveTourStopRole = (
  slug: string,
  suggestion: TourSuggestion,
): TourStopRole | null => {
  if (slug === suggestion.anchorSlug) return 'ancora'
  if (slug === suggestion.seedSlug) return 'semente'
  return suggestion.satelliteSlugs.includes(slug) ? 'satelite' : null
}

/**
 * The activity kind each role generates. There is no `visita` kind and E13 does
 * not add one: `activity.deputyPresent` already IS the candidate-presence
 * marker, so every stop keeps the real kind of what happens there — an act at
 * the anchor, a support meeting at a stop that is being opened.
 */
export const tourStopRoleActivityKind: Record<TourStopRole, ActivityKind> = {
  ancora: 'comicio',
  satelite: 'reuniao_apoio',
  semente: 'reuniao_apoio',
}

/**
 * A giro is a day or two of the candidate's agenda. The cap is not a UI detail:
 * it is what keeps one submit from writing an unbounded batch of drafts.
 */
export const MAX_TOUR_STOPS = 8

/**
 * The giro's name is a prefix of every stop's title, so the client's `maxLength`
 * and the server's boundary check have to be the same number. It is well under
 * the activity title bound (160) plus the longest município name, which is why
 * the composed title needs no second check.
 */
export const MAX_TOUR_NAME_LENGTH = 90

/**
 * The failures the composer is allowed to show verbatim. They live here, next to
 * the cap they describe, because the action that throws them is a `'use server'`
 * module (which may only export async functions) and the form action that lists
 * them as safe must not spell them a second time.
 */
export const TOUR_EMPTY_MESSAGE = 'Selecione ao menos uma parada do giro.'
export const TOUR_STAFF_ONLY_MESSAGE = 'Apenas a equipe da campanha pode planejar um giro.'
export const TOUR_OUT_OF_SCOPE_MESSAGE =
  'Algum município do giro saiu do seu escopo. Atualize a página e monte o giro novamente.'
export const TOUR_MAX_STOPS_MESSAGE = `Um giro aceita no máximo ${MAX_TOUR_STOPS} paradas.`
