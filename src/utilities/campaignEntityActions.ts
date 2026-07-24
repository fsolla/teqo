import 'server-only'

import type { Payload } from 'payload'

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
    const message = error instanceof Error ? error.message : String(error)
    if (policy.conflictPattern.test(message)) {
      throw new Error(policy.conflictMessage)
    }
    throw error
  }
}
