import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser, Contact, Leadership } from '@/payload-types'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export type ActionPlanLeadershipOption = {
  id: number
  label: string
}

/**
 * Engaged leaderships visible to the actor (for linking a plan to a leadership).
 * Uses overrideAccess: false so Payload row-level access applies.
 */
export const getActionPlanLeadershipOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
): Promise<ActionPlanLeadershipOption[]> => {
  const result = await payload.find({
    collection: 'leadership',
    where: { supportStatus: { equals: 'engajado' } },
    depth: 1,
    limit: 200,
    sort: 'id',
    select: {
      contact: true,
      supportStatus: true,
    },
    user,
    overrideAccess: false,
  })

  return result.docs
    .map((doc) => {
      const leadership = doc as Leadership
      const id = relationshipId(leadership.id)
      if (!id) return null
      const contact = leadership.contact
      const label = isPopulatedRelationship<Contact>(contact)
        ? contact.name
        : `Liderança #${id}`
      return { id, label }
    })
    .filter((option): option is ActionPlanLeadershipOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
}
