// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

import type { Access, PayloadRequest } from 'payload'

import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import type { CampaignActor, DynamicFind } from '@/utilities/access/shared'
import {
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isCampaignUser,
  isPayloadAdmin,
} from '@/utilities/access/shared'
import { relationshipId } from '@/utilities/relationship'

type ContactID = number

const ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY = 'campaignAccessibleContactIds'

export const getAccessibleContactIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<ContactID[]> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
  const leadershipWhere =
    currentUser.role === 'leader'
      ? {
          and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
        }
      : {
          municipalities: {
            in: municipalityIDs ?? [],
          },
        }

  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  const collections = req.payload.collections as Record<string, unknown>
  const contactIDs: ContactID[] = []

  if (collections.leadership) {
    const leadershipResult = await find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { contact: true },
      where: leadershipWhere,
    })
    for (const doc of leadershipResult.docs) {
      const id = relationshipId(doc.contact)
      if (id !== null) contactIDs.push(id)
    }
  }

  // Advisors read contacts of supporters in their municipalities; leaders read
  // contacts of the supporters they created — mirroring `canReadSupporter`.
  const supporterWhere =
    currentUser.role === 'advisor'
      ? { municipality: { in: municipalityIDs ?? [] } }
      : currentUser.role === 'leader'
        ? { createdBy: { equals: currentUser.id } }
        : null

  if (supporterWhere && collections.supporter) {
    const supporterResult = await find({
      collection: 'supporter',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { contact: true },
      where: supporterWhere,
    })
    for (const doc of supporterResult.docs) {
      const id = relationshipId(doc.contact)
      if (id !== null) contactIDs.push(id)
    }
  }

  const ids = [...new Set(contactIDs)]
  context[cacheKey] = ids

  return ids
}

export const canReadContacts: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser) return false

  const ids = await getAccessibleContactIds(req, currentUser)

  return {
    id: {
      in: ids,
    },
  }
}

export const canManageContacts: Access = ({ req }) => isPayloadAdmin(req.user)
