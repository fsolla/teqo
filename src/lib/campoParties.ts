import { normalizePartySigla } from '@/lib/electionPartySpectrum'

/**
 * Curated "campo" (Solla/PT political field) parties by year, used for the
 * deputado-federal "share intracampo" diagnostic (E8): of the votes that went
 * to the field, how many went to Solla specifically. This is NOT the same
 * concept as `electionPartySpectrum.ts` (ideological esquerda/centro/direita
 * bucket, from the Bolognesi et al. expert survey) — every entry here MUST
 * also be in the `esquerda` bucket (enforced by
 * `tests/unit/campoParties.unit.spec.ts`), but the reverse isn't required:
 * plenty of `esquerda`-bucket parties are not part of this specific ticket's
 * field in a given year.
 *
 * Deliberately NOT inferred from the raw TSE `coalition` string on
 * `electionCandidateVote`: Brazilian proportional "coligações" bundle
 * opportunistic, ideologically unrelated allies purely to maximize the
 * quotient. Confirmed against the locally seeded 2014/2018 data — Solla's own
 * registered coalition that year also included PP, PR, PSD, PTB (2014) /
 * PODE, PP, PR, PSD (2018), none of which belong in the political field.
 *
 * Sourcing:
 * - 2014: coalition "MAIS MUDANÇAS, NOVAS CONQUISTAS" (BA, deputado federal) —
 *   PT's core-left partners inside it: PC do B, PDT.
 * - 2018: coalition "FRENTE DO TRABALHO POR TODA BAHIA" (BA, deputado
 *   federal) — PT's core-left partners inside it: PC do B, PSB.
 * - 2022: PT ran under the "Federação Brasil da Esperança — FE Brasil"
 *   (PT/PC do B/PV), a permanent partisan federation (TSE registered it
 *   2022-05-24) — not a temporary coalition. Verified via TSE candidate
 *   filing (Folha "Ficha do candidato" 2022) and press coverage (Estadão,
 *   Bahia Notícias). PSB backed the same governismo ticket for governor that
 *   year but ran its own deputado-federal slate outside the federation, so it
 *   is excluded from the 2022 federal-deputy field (would double count a
 *   separate slate as "ours").
 * - 2026: FE Brasil is legally bound to stay unified through the end of the
 *   2023–2026 mandate, so it carries over unchanged. Revisit once 2026
 *   deputado-federal candidacies are registered (TSE `consulta_cand_2026`).
 */
export type CampoElectionYear = 2014 | 2018 | 2022 | 2026

const CAMPO_PARTIES_BY_YEAR: Readonly<Record<CampoElectionYear, readonly string[]>> = {
  2014: ['PT', 'PCDOB', 'PDT'],
  2018: ['PT', 'PCDOB', 'PSB'],
  2022: ['PT', 'PCDOB', 'PV'],
  2026: ['PT', 'PCDOB', 'PV'],
}

export const CAMPO_ELECTION_YEARS = Object.keys(CAMPO_PARTIES_BY_YEAR).map(
  Number,
) as CampoElectionYear[]

export const isCampoElectionYear = (year: number): year is CampoElectionYear =>
  (CAMPO_ELECTION_YEARS as readonly number[]).includes(year)

/** Campo party siglas (already normalized) for one year, or [] for an unknown year. */
export const campoPartiesForYear = (year: number): readonly string[] =>
  isCampoElectionYear(year) ? CAMPO_PARTIES_BY_YEAR[year] : []

/** Whether a TSE party sigla belongs to the curated field for that year. */
export const isCampoParty = (party: string | null | undefined, year: number): boolean => {
  const normalized = normalizePartySigla(party)
  if (!normalized) return false
  return campoPartiesForYear(year).includes(normalized)
}
