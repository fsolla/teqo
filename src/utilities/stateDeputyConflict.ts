import 'server-only'

import {
  STATE_DEPUTY_CONFLICT_MESSAGE,
  STATE_DEPUTY_STAFF_MESSAGE,
} from '@/lib/schemas/stateDeputy'
import type { StaffEntityPolicy } from '@/utilities/campaignEntityActions'

/**
 * C128 — shared dobradinha identity-conflict policy. Was private to
 * `actions/stateDeputy.ts`; the person lifecycle
 * (`setPersonStateDeputyMunicipalitiesRecord`) creates dobradinhas too, and
 * the `contact`/`slug` unique violations must map to the same safe message in
 * both surfaces. Lives outside the 'use server' module because a plain const
 * cannot be re-exported from one (Next.js allows only async function exports
 * there).
 */

export const stateDeputyPolicy: StaffEntityPolicy = {
  staffMessage: STATE_DEPUTY_STAFF_MESSAGE,
  conflictPattern: /state_deputy_(contact|slug)|duplicate key/i,
  conflictMessage: STATE_DEPUTY_CONFLICT_MESSAGE,
}
