import { LEADERSHIP_STAFF_MESSAGE } from '@/lib/schemas/leadership'
import { OPS_UPDATED_AT_CONFLICT_MESSAGE } from '@/lib/schemas/opsCas'

/** Shared form-error copy for leadership staff edits — kept out of `'use server'` files. */
export const leadershipStaffEditSafeMessages = [
  LEADERSHIP_STAFF_MESSAGE,
  OPS_UPDATED_AT_CONFLICT_MESSAGE,
] as const
