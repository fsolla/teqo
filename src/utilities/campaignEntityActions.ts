import 'server-only'

import { ValidationError, type Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { reloadStaffActor } from '@/utilities/campaignActionContext'

/**
 * Shared policy for simple staff-managed reference entities (organizações,
 * dobradinhas): fresh staff assert → run the caller's concretely-typed
 * mutation → translate unique-index conflicts into a safe user-facing message.
 */
export type StaffEntityPolicy = {
  /** Thrown when the fresh actor is not campaign staff. */
  staffMessage: string
  /** Matches the collection's unique-index violation. */
  conflictPattern: RegExp
  /** Safe user-facing message for a unique conflict. */
  conflictMessage: string
}

/**
 * Translates a unique-index violation into the policy's safe message, or
 * returns `null` when the error is something else. Two shapes cover the same
 * failure: the DB constraint the `conflictPattern` matches (an insert race),
 * and Payload's `ValidationError` — Payload validates `unique` fields BEFORE
 * the insert and throws a localized \"O campo a seguir está inválido: <field>\"
 * that the pattern can never match, which is how the normal duplicate case
 * surfaces. (After a zod gate, the only validation left on these create/update
 * paths IS the unique check, so a `ValidationError` here is a duplicate.)
 */
export const mapStaffEntityConflict = (error: unknown, policy: StaffEntityPolicy): Error | null => {
  const message = error instanceof Error ? error.message : String(error)
  if (policy.conflictPattern.test(message) || error instanceof ValidationError) {
    return new Error(policy.conflictMessage)
  }
  return null
}

export const runStaffEntityMutation = async <Result>(
  payload: Payload,
  actor: CampaignUser,
  policy: StaffEntityPolicy,
  mutate: (currentActor: CampaignUser) => Promise<Result>,
): Promise<Result> => {
  const currentActor = await reloadStaffActor(payload, actor, policy.staffMessage)

  try {
    return await mutate(currentActor)
  } catch (error) {
    const conflict = mapStaffEntityConflict(error, policy)
    if (conflict) throw conflict
    throw error
  }
}
