import { z } from 'zod'

import { POTENTIAL_UFS } from '@/lib/sectionPotential'

/**
 * S46 — wire contract of the public `/api/potencial` reads. Strict objects:
 * an extra query key is malformed, never silently ignored. The section numbers
 * follow the title's shapes (zona 2–4 dígitos, seção até 4) and are normalized
 * by the callers; the município is the TSE code the combobox picked.
 */
export const potentialMunicipiosQuerySchema = z.strictObject({
  uf: z.enum(POTENTIAL_UFS),
})

export const potentialSectionQuerySchema = z.strictObject({
  uf: z.enum(POTENTIAL_UFS),
  /** Código TSE do município (`CD_MUNICIPIO`) — não é slug de URL. */
  codigo: z.coerce.number().int().positive(),
  zona: z.coerce.number().int().min(1).max(9999),
  secao: z.coerce.number().int().min(1).max(9999),
})
