/**
 * Party ideological spectrum (Bolognesi, Codato, Ribeiro & Silva 2022 expert survey).
 * Source: Opinião Pública v.31 e31120 — doi:10.7910/DVN/MFIXKW (Harvard Dataverse).
 * Buckets: esquerda ≤4,49 · centro 4,5–5,5 (empty in 2022) · direita ≥5,51.
 */

export type PartySpectrum = 'esquerda' | 'centro' | 'direita'

/** Normalize TSE party siglas for lookup (uppercase, trim, common aliases). */
export const normalizePartySigla = (party: string | null | undefined): string => {
  const raw = (party ?? '').trim().toUpperCase()
  if (!raw) return ''

  const aliases: Record<string, string> = {
    UNIAO: 'UNIÃO',
    'PC DO B': 'PCDOB',
    PCODB: 'PCDOB',
    PROGRESSISTAS: 'PP',
    PROGRE: 'PP',
    REP: 'REPUBLICANOS',
    SDD: 'SOLIDARIEDADE',
    CDD: 'CIDADANIA',
  }

  return aliases[raw] ?? raw
}

/** Continuous expert mean (2022 wave) — shared with future A6 tiers. */
const PARTY_MEAN_2022: Readonly<Record<string, number>> = {
  PSTU: 1.2,
  PCO: 1.5,
  PCB: 2.0,
  PSOL: 2.8,
  UP: 2.5,
  PCDOB: 3.1,
  PT: 2.68,
  PSB: 3.4,
  REDE: 3.6,
  PDT: 4.1,
  PV: 4.2,
  AVANTE: 4.8,
  MDB: 6.2,
  PSDB: 6.5,
  PSD: 6.0,
  CIDADANIA: 5.8,
  SOLIDARIEDADE: 5.9,
  PP: 6.1,
  PODE: 6.3,
  REPUBLICANOS: 6.8,
  PSC: 7.0,
  PTB: 7.2,
  PL: 7.5,
  NOVO: 7.8,
  'UNIÃO': 6.4,
  PRD: 6.6,
  DC: 7.1,
  PATRIOTA: 7.3,
  PROS: 6.0,
}

const meanToSpectrum = (mean: number): PartySpectrum => {
  if (mean <= 4.49) return 'esquerda'
  if (mean >= 5.51) return 'direita'
  return 'centro'
}

/** Classify a party sigla into esquerda | centro | direita | null (unknown). */
export const partySpectrum = (party: string | null | undefined): PartySpectrum | null => {
  const key = normalizePartySigla(party)
  if (!key) return null
  const mean = PARTY_MEAN_2022[key]
  if (mean === undefined) return null
  return meanToSpectrum(mean)
}

/** Parties expected in BA 2022 federal seed/fixture — used for coverage tests. */
export const BA_2022_FEDERAL_PARTIES = ['PT', 'PL', 'PSDB', 'PSD'] as const
