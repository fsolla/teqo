import { isCampoParty } from '@/lib/campoParties'
import { partySpectrum } from '@/lib/electionPartySpectrum'
import type { ElectionOffice } from '@/lib/electionResults'

/**
 * A6 — dobradinha opportunities: proportional candidates running again in 2026
 * (`runningAgain2026 === 'sim'`), ranked for one municipality geography by
 * political alignment with the PT/Solla ticket and local 2022 electoral force.
 *
 * The alignment taxonomy composes the two existing party maps instead of
 * inventing a third one: the curated 2026 field (`campoParties.ts`, FE Brasil)
 * and the Bolognesi et al. 2022 ideological spectrum (`electionPartySpectrum.ts`
 * — the continuous means were kept there explicitly "shared with future A6
 * tiers"). Unknown parties fail to the MIDDLE (`neutro`), never to `aliado`
 * (would invent trust) nor to `adversario` (would invent hostility).
 */

export const TICKET_PARTNER_OFFICES = ['deputado_federal', 'deputado_estadual'] as const
export type TicketPartnerOffice = (typeof TICKET_PARTNER_OFFICES)[number]

export const isTicketPartnerOffice = (office: ElectionOffice): office is TicketPartnerOffice =>
  (TICKET_PARTNER_OFFICES as readonly ElectionOffice[]).includes(office)

export type TicketPartnerTier = 'aliado' | 'aliadoHistorico' | 'neutro' | 'adversario'

export const ticketPartnerTierLabels: Record<TicketPartnerTier, string> = {
  aliado: 'Aliado',
  aliadoHistorico: 'Aliado histórico',
  neutro: 'Neutro',
  adversario: 'Adversário',
}

export const ticketPartnerOfficeLabels: Record<TicketPartnerOffice, string> = {
  deputado_federal: 'Dep. Federal',
  deputado_estadual: 'Dep. Estadual',
}

/** Campo year read for the tier lookup — FE Brasil carries over per campoParties. */
const TICKET_PARTNER_CAMPO_YEAR = 2026

export const ticketPartnerTierForParty = (party: string | null | undefined): TicketPartnerTier => {
  if (isCampoParty(party, TICKET_PARTNER_CAMPO_YEAR)) return 'aliado'
  const spectrum = partySpectrum(party)
  switch (spectrum) {
    case 'esquerda':
      return 'aliadoHistorico'
    case 'centro':
      return 'neutro'
    case 'direita':
      return 'adversario'
    case null:
      return 'neutro'
    default: {
      const exhaustive: never = spectrum
      throw new Error(`Unhandled party spectrum: ${String(exhaustive)}`)
    }
  }
}

/**
 * Score weights (default documented in docs/plans/insight-dobradinha-2026.md,
 * revisable with product): alignment outweighs force — a dobradinha is first a
 * political-trust decision, then a vote count.
 */
const TICKET_PARTNER_ALIGNMENT_WEIGHT = 0.6
const TICKET_PARTNER_VOTES_WEIGHT = 0.4

const TICKET_PARTNER_TIER_WEIGHTS: Record<TicketPartnerTier, number> = {
  aliado: 1,
  aliadoHistorico: 0.7,
  neutro: 0.35,
  adversario: 0.1,
}

export const TICKET_PARTNER_LIST_LIMIT = 10

export type TicketPartnerInput = {
  office: TicketPartnerOffice
  candidateNumber: number
  name: string
  party: string | null
  elected2022: boolean
  votes2022: number
}

export type TicketPartnerOpportunity = TicketPartnerInput & {
  tier: TicketPartnerTier
  score: number
}

export type TicketPartnerResult =
  | { status: 'pending2026' }
  | { status: 'ready'; opportunities: TicketPartnerOpportunity[] }

/**
 * Rank candidates by `0.6 * tierWeight + 0.4 * normalizedVotes`, where votes
 * are normalized by the strongest candidate INSIDE the municipality set — a
 * relative, local reading, never a statewide share (docs/research kernel).
 * Ties break on raw votes, then name.
 */
export const computeTicketPartnerOpportunities = (
  candidates: readonly TicketPartnerInput[],
  limit = TICKET_PARTNER_LIST_LIMIT,
): TicketPartnerOpportunity[] => {
  const maxVotes = Math.max(0, ...candidates.map((candidate) => Math.max(0, candidate.votes2022)))

  const scored = candidates.map((candidate) => {
    const tier = ticketPartnerTierForParty(candidate.party)
    const normalizedVotes = maxVotes > 0 ? Math.max(0, candidate.votes2022) / maxVotes : 0
    const score =
      Math.round(
        (TICKET_PARTNER_ALIGNMENT_WEIGHT * TICKET_PARTNER_TIER_WEIGHTS[tier] +
          TICKET_PARTNER_VOTES_WEIGHT * normalizedVotes) *
          1000,
      ) / 1000
    return { ...candidate, tier, score }
  })

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.votes2022 - a.votes2022 ||
      a.name.localeCompare(b.name, 'pt-BR') ||
      // Same-name urna candidates are a real TSE phenomenon — keep the order
      // deterministic across requests and cache entries.
      a.candidateNumber - b.candidateNumber,
  )
  return scored.slice(0, limit)
}
