import { OPS_UPDATED_AT_CONFLICT_MESSAGE } from '@/lib/schemas/opsCas'

/** Shared form-error copy for municipality staff edits — kept out of `'use server'` files. */
export const municipalityStaffEditSafeMessages = [
  'Somente a coordenação e a assessoria podem editar o município.',
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
] as const
