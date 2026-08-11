import 'server-only'

import type { Payload } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { populatedContactName } from '@/lib/relationship'
import {
  activityResponsibleTypeLabels,
  type ActivityResponsibleCollection,
} from '@/lib/schemas/activity'
import type { CampaignUser } from '@/payload-types'
import { searchActivityLeadershipOptions } from '@/utilities/activityLeadershipOptions'
import { eligibleCampaignStaffWhere } from '@/utilities/campaignAccess'

export type ActivityResponsibleSearchOption = {
  relationTo: ActivityResponsibleCollection
  id: number
  name: string
  typeLabel: string
}

const RESPONSIBLE_SEARCH_LIMIT = 20

const toResponsibleOption = (
  relationTo: ActivityResponsibleCollection,
  id: number,
  name: string,
): ActivityResponsibleSearchOption => ({
  relationTo,
  id,
  name,
  typeLabel: activityResponsibleTypeLabels[relationTo],
})

/**
 * C90 — one async catalog across the three responsible types: eligible staff,
 * engaged leaderships and dobradinhas, each read through the actor's own
 * access (`overrideAccess: false`), so a leadership outside an advisor's
 * portfolio never shows up as a responsible option.
 */
export const searchActivityResponsibleOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  query: string,
): Promise<ActivityResponsibleSearchOption[]> => {
  const normalizedQuery = typeof query === 'string' ? query : ''
  if (!isContactSearchQueryReady(normalizedQuery)) return []

  const { trimmed, digits } = normalizeContactSearchQuery(normalizedQuery)

  const [staff, leaderships, deputies] = await Promise.all([
    searchStaffResponsibles(payload, user, trimmed),
    searchActivityLeadershipOptions(payload, user, trimmed),
    searchStateDeputyResponsibles(payload, user, trimmed, digits),
  ])

  const staffOptions = staff.map(({ id, name }) => toResponsibleOption('campaignUser', id, name))
  const leadershipOptions = leaderships.map(({ id, label }) =>
    toResponsibleOption('leadership', id, label),
  )
  const deputyOptions = deputies.map(({ id, name }) => toResponsibleOption('stateDeputy', id, name))

  return [...staffOptions, ...leadershipOptions, ...deputyOptions].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR'),
  )
}

const searchStaffResponsibles = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  trimmed: string,
) => {
  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [eligibleCampaignStaffWhere, ...(trimmed ? [{ name: { contains: trimmed } }] : [])],
    },
    depth: 0,
    limit: RESPONSIBLE_SEARCH_LIMIT,
    page: 1,
    select: { name: true },
    user,
    overrideAccess: false,
  })
  return result.docs.map(({ id, name }) => ({ id, name: name ?? `Equipe #${id}` }))
}

const searchStateDeputyResponsibles = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  trimmed: string,
  digits: string,
) => {
  const result = await payload.find({
    collection: 'stateDeputy',
    where: {
      or: [
        { 'contact.name': { contains: trimmed } },
        { 'contact.phones.value': { contains: digits || trimmed } },
      ],
    },
    depth: 1,
    limit: RESPONSIBLE_SEARCH_LIMIT,
    page: 1,
    sort: 'contact.name',
    select: { contact: true, party: true },
    user,
    overrideAccess: false,
  })
  return result.docs.map((stateDeputy) => {
    const plainName = populatedContactName(stateDeputy.contact)
    return {
      id: stateDeputy.id,
      name: stateDeputy.party ? `${plainName} (${stateDeputy.party})` : plainName,
    }
  })
}
