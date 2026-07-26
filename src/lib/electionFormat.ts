/**
 * Vote counts are whole votes, including the derived ones (E8's decomposed
 * suggested goal and its deficit are fractional). Without pinning the fraction
 * digits, pt-BR renders a goal of 100.968 votes as "100,968" — read as a
 * hundred thousand by every human in the room.
 */
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Shares and multiples: one decimal at most, never a forced trailing zero. */
export const oneDecimalFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

export const formatElectionNumber = (value: number): string => numberFormatter.format(value)

/**
 * A ratio (0..1) as a share label with at most one decimal — the shape used
 * for "% da própria votação estadual". Lives here, not next to the ranking it
 * was written for, so client bundles can format a share without pulling the
 * committed TSE artifact along with it.
 */
export const formatVoteSharePercent = (share: number): string =>
  `${oneDecimalFormatter.format(share * 100)}%`

/**
 * A placement as a pt-BR ordinal — "4º". Used for both rankings the product
 * shows (a município among the 435, A11; the candidate among those votados
 * num município, B13), and here for the same bundle reason as the share above.
 */
export const formatPlacementOrdinal = (rank: number): string => `${formatElectionNumber(rank)}º`
