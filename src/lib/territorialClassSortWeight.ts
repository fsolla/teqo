/**
 * Ordinal weights for `classe` list sort (client-safe).
 * Single source for municipality list (E10) and territory list (E12).
 */
export const territorialClassSortWeight = {
  reduto: 4,
  expansao: 3,
  manutencao: 2,
  marginal: 1,
  sem_base: null,
} as const satisfies Record<
  'reduto' | 'expansao' | 'manutencao' | 'marginal' | 'sem_base',
  number | null
>
