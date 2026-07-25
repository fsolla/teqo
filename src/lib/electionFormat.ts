/**
 * Vote counts are whole votes, including the derived ones (E8's decomposed
 * suggested goal and its deficit are fractional). Without pinning the fraction
 * digits, pt-BR renders a goal of 100.968 votes as "100,968" — read as a
 * hundred thousand by every human in the room.
 */
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const formatElectionNumber = (value: number): string => numberFormatter.format(value)
