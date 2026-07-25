import 'server-only'

import type { Payload } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import type { CampaignUser, Contact, Leadership } from '@/payload-types'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export type ActionPlanLeadershipOption = {
  id: number
  label: string
}

const LEADERSHIP_SEARCH_LIMIT = 20

const leadershipLabel = (leadership: Leadership): string | null => {
  const id = relationshipId(leadership.id)
  if (!id) return null
  const contact = leadership.contact
  return isPopulatedRelationship<Contact>(contact) ? contact.name : `Liderança #${id}`
}

/**
 * Engaged leaderships visible to the actor (for linking a plan to a leadership).
 * Uses overrideAccess: false so Payload row-level access applies.
 */
export const searchActionPlanLeadershipOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  query: string,
): Promise<ActionPlanLeadershipOption[]> => {
  const normalizedQuery = typeof query === 'string' ? query : ''
  if (!isContactSearchQueryReady(normalizedQuery)) return []

  const { trimmed, digits } = normalizeContactSearchQuery(normalizedQuery)

  const result = await payload.find({
    collection: 'leadership',
    where: {
      and: [
        { supportStatus: { equals: 'engajado' } },
        {
          or: [
            { 'contact.name': { contains: trimmed } },
            { 'contact.phone': { contains: digits || trimmed } },
          ],
        },
      ],
    },
    depth: 1,
    limit: LEADERSHIP_SEARCH_LIMIT,
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
      const label = leadershipLabel(leadership)
      if (!id || !label) return null
      return { id, label }
    })
    .filter((option): option is ActionPlanLeadershipOption => option !== null)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
}
