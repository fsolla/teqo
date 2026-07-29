/**
 * The TSE election years, as a zero-dependency leaf (P3-K): the suggestion
 * catalog mirrored these three numbers rather than importing
 * `lib/electionResults` (whose first import drags the territory table into
 * the client chunk — the B14 lesson). The leaf has no imports, so the mirror
 * AND the documented excuse for it both die.
 */
export const ELECTION_YEAR_2014 = 2014 as const
export const ELECTION_YEAR_2018 = 2018 as const
export const ELECTION_YEAR_2022 = 2022 as const
