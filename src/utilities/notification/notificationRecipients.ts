import 'server-only'

/** Trusted server reads in this module use admin bypass (`overrideAccess: true`). */

import type { Payload } from 'payload'

import { uniqueRelationshipIds } from '@/lib/relationship'

import type { NotificationWriteRequest } from '@/utilities/notification/createCampaignNotification'

const UNRESTRICTED_ROLES = ['coordinator', 'candidate'] as const

const loadUnrestrictedStaffUserIds = async (
  payload: Payload,
  req?: NotificationWriteRequest,
): Promise<number[]> => {
  const result = await payload.find({
    collection: 'campaignUser',
    where: { role: { in: [...UNRESTRICTED_ROLES] } },
    depth: 0,
    limit: 200,
    pagination: false,
    overrideAccess: true,
    req,
  })

  return result.docs.map((doc) => doc.id)
}

const loadMunicipalityAdvisorUserIds = async (
  payload: Payload,
  municipalityID: number,
  req?: NotificationWriteRequest,
): Promise<number[]> => {
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { advisors: true },
    overrideAccess: true,
    req,
  })

  return uniqueRelationshipIds(municipality.advisors)
}

type MunicipalityStaffRecipientsOptions = {
  excludeUserId?: number | null
  includeUnrestricted?: boolean
}

/** Advisors of the município plus optional coordinator/candidate staff. */
export const resolveMunicipalityStaffRecipientIds = async (
  payload: Payload,
  municipalityID: number,
  options: MunicipalityStaffRecipientsOptions = {},
  req?: NotificationWriteRequest,
): Promise<number[]> => {
  const { excludeUserId = null, includeUnrestricted = true } = options
  const [advisorIDs, unrestrictedIDs] = await Promise.all([
    loadMunicipalityAdvisorUserIds(payload, municipalityID, req),
    includeUnrestricted ? loadUnrestrictedStaffUserIds(payload, req) : Promise.resolve([]),
  ])

  const recipientIDs = [...new Set([...advisorIDs, ...unrestrictedIDs])]
  if (excludeUserId === null) return recipientIDs

  return recipientIDs.filter((id) => id !== excludeUserId)
}
