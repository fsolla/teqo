// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

import type { Access, PayloadRequest } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { getAccessibleMunicipalityIds } from '@/utilities/access/municipalities'
import type { CampaignActor, DynamicFind } from '@/utilities/access/shared'
import {
  advisorMunicipalityScopeWhere,
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isPayloadAdmin,
  resolveAccessibleIds,
} from '@/utilities/access/shared'

type ContactID = number

const ACCESSIBLE_CONTACT_IDS_MEMO_KEY = 'campaignAccessibleContactIds'

const getAccessibleContactIds = (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<ContactID[] | null> =>
  resolveAccessibleIds(req, user, ACCESSIBLE_CONTACT_IDS_MEMO_KEY, async (currentUser) => {
    const municipalityIDs = await getAccessibleMunicipalityIds(req, currentUser)
    const leadershipWhere =
      currentUser.role === 'leader'
        ? {
            and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
          }
        : // C141 — Visão "Tudo" widens the leadership-derived part of the people
          // list; the supporter-derived part below stays carteira (PII cap).
          currentUser.role === 'advisor' && currentUser.visibility === 'tudo'
          ? {}
          : advisorMunicipalityScopeWhere('municipalities', municipalityIDs)

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

    // Advisors already read every dobradinha. Include the normalized Contacts
    // backing those rows without widening access to other Contacts.
    if (currentUser.role === 'advisor' && collections.stateDeputy) {
      // Intentional admin bypass: StateDeputy access already scopes the advisor's rows.
      const stateDeputyResult = await find({
        collection: 'stateDeputy',
        depth: 0,
        limit: 0,
        overrideAccess: true,
        pagination: false,
        req,
        select: { contact: true },
        where: {},
      })
      for (const doc of stateDeputyResult.docs) {
        const id = relationshipId(doc.contact)
        if (id !== null) contactIDs.push(id)
      }
    }

    // Advisors read contacts of supporters in their municipalities; leaders read
    // contacts of the supporters they created — mirroring `canReadSupporter`.
    const supporterWhere =
      currentUser.role === 'advisor'
        ? advisorMunicipalityScopeWhere('municipality', municipalityIDs)
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

    return [...new Set(contactIDs)]
  })

export const canReadContacts: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignUnrestricted(currentUser)) return true
  if (!currentUser) return false

  const ids = await getAccessibleContactIds(req, currentUser)
  if (ids === null) return true

  return {
    id: {
      in: ids,
    },
  }
}

export const canManageContacts: Access = ({ req }) => isPayloadAdmin(req.user)
