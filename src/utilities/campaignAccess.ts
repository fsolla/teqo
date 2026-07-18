import type { CampaignUser, User } from '@/payload-types'
import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

import { relationshipId } from '@/utilities/relationship'

type CampaignActor = CampaignUser | User | null | undefined
type NucleusID = number
type AccessibleNucleusIDs = NucleusID[] | null
type ContactID = number

const ACCESSIBLE_NUCLEUS_IDS_CONTEXT_KEY = 'campaignAccessibleNucleusIds'
const ACCESSIBLE_CONTACT_IDS_CONTEXT_KEY = 'campaignAccessibleContactIds'
const CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY = 'campaignUserPhoneAccess'

export const isPayloadAdmin = (user: CampaignActor): user is User => user?.collection === 'users'

const isCampaignUser = (user: CampaignActor): user is CampaignUser =>
  user?.collection === 'campaignUser'

export const isCampaignGeneral = (user: CampaignActor): boolean =>
  isCampaignUser(user) && user.role === 'geral'

export const getFreshCampaignUser = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<CampaignUser | null> => {
  if (!isCampaignUser(user)) return null

  try {
    return await req.payload.findByID({
      collection: 'campaignUser',
      id: user.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch {
    return null
  }
}

export const canManageCampaignUsers: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canManageCampaignUserRole: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canReadCampaignUsers: Access = ({ req }) =>
  isPayloadAdmin(req.user) || isCampaignUser(req.user)

export const canReadCampaignUserIdentity: FieldAccess = ({ req, id }) => {
  if (isPayloadAdmin(req.user)) return true
  if (!isCampaignUser(req.user)) return false

  return id !== undefined && String(id) === String(req.user.id)
}

export const canCreateElectoralNucleus: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canReadElectoralNucleus: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const ids = await getAccessibleNucleusIds(req)
  if (ids === null) return true

  return {
    id: {
      in: ids,
    },
  }
}

export const canUpdateElectoralNucleus: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  return {
    coordinators: {
      contains: currentUser.id,
    },
  }
}

export const canDeleteElectoralNucleus: Access = ({ req }) => isPayloadAdmin(req.user)

export const canReadContacts: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (!currentUser) return false

  const ids = await getAccessibleContactIds(req, currentUser)

  return {
    id: {
      in: ids,
    },
  }
}

export const canManageContacts: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetAdministrativeLeadershipField: FieldAccess = ({ req }) =>
  isPayloadAdmin(req.user)

export const canReadLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (!currentUser) return false

  if (currentUser.role === 'lideranca') {
    const leadershipScope: Where = {
      and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
    }
    return leadershipScope
  }

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)

  return {
    nucleus: {
      in: nucleusIDs ?? [],
    },
  }
}

export const canCreateLeadership: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const nucleus = relationshipId(data?.nucleus)
  if (!nucleus) return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  return nucleusIDs?.includes(nucleus) ?? false
}

export const canManageLeadership: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)

  return {
    nucleus: {
      in: nucleusIDs ?? [],
    },
  }
}

export const canDeleteLeadership: Access = ({ req }) => isPayloadAdmin(req.user)

export const canCreateNucleusUpdate: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (!currentUser) return false

  const nucleus = relationshipId(data?.nucleus)
  if (!nucleus) return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  return nucleusIDs?.includes(nucleus) ?? false
}

export const canReadNucleusUpdate: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (!currentUser) return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  const nucleusScope: Where = {
    nucleus: {
      in: nucleusIDs ?? [],
    },
  }

  if (currentUser.role !== 'lideranca') return nucleusScope

  return {
    and: [nucleusScope, { author: { equals: currentUser.id } }],
  }
}

export const canMutateNucleusUpdate: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetNucleusUpdateAuthor: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canCreateCampaignInvite: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const leadershipID = relationshipId(data?.leadership)
  if (!leadershipID) return false

  try {
    const leadership = await req.payload.findByID({
      collection: 'leadership',
      id: leadershipID,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const nucleusID = relationshipId(leadership.nucleus)
    const accessibleNucleusIDs = await getAccessibleNucleusIds(req, currentUser)

    return nucleusID !== null && (accessibleNucleusIDs?.includes(nucleusID) ?? false)
  } catch {
    return false
  }
}

export const canReadCampaignInvite: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const accessibleNucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  const leaderships = await req.payload.find({
    collection: 'leadership',
    where: {
      nucleus: {
        in: accessibleNucleusIDs ?? [],
      },
    },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })

  return {
    leadership: {
      in: leaderships.docs.map((leadership) => leadership.id),
    },
  }
}

export const canMutateCampaignInvite: Access = ({ req }) => isPayloadAdmin(req.user)

export const canSetCampaignInviteSystemField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canReadLeadershipInternal: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  return currentUser?.role === 'geral' || currentUser?.role === 'coordenador'
}

export const canManageLeadershipInternal: FieldAccess = canReadLeadershipInternal

export const canCreateSupporter: Access = async ({ data, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const nucleus = relationshipId(data?.nucleus)
  if (!nucleus) return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  return nucleusIDs?.includes(nucleus) ?? false
}

export const canReadSupporter: Access = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (isCampaignGeneral(currentUser)) return true
  if (currentUser?.role !== 'coordenador') return false

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)

  return {
    nucleus: {
      in: nucleusIDs ?? [],
    },
  }
}

export const canManageSupporter: Access = canReadSupporter

export const canDeleteSupporter: Access = ({ req }) => isPayloadAdmin(req.user)

export const canCreateNucleusCoordinators: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canManageNucleusCoordinators: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

export const canManageNucleusLifecycle: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canSetDerivedNucleusField: FieldAccess = ({ req }) => isPayloadAdmin(req.user)

/** Public TSE election data: any authenticated campaign or admin user may read. */
export const canReadElectionData: Access = ({ req }) =>
  isPayloadAdmin(req.user) || isCampaignUser(req.user)

/** Election reference data is mutated only by Payload admins (or CLI with overrideAccess). */
export const canMutateElectionData: Access = ({ req }) => isPayloadAdmin(req.user)

type DynamicFind = (args: {
  collection: string
  depth: number
  limit: number
  overrideAccess: true
  pagination: false
  req: PayloadRequest
  select: Record<string, true>
  where: Record<string, unknown>
}) => Promise<{ docs: Array<Record<string, unknown>> }>

/**
 * Returns null for unrestricted general coordination, otherwise the nucleus
 * IDs currently assigned to the authenticated campaign user.
 */
export const getAccessibleNucleusIds = async (
  req: PayloadRequest,
  user: CampaignActor = req.user,
): Promise<AccessibleNucleusIDs> => {
  const currentUser =
    isCampaignUser(user) && user === req.user ? await getFreshCampaignUser(req, user) : user

  if (!isCampaignUser(currentUser)) return []
  if (isCampaignGeneral(currentUser)) return null

  const context = req.context as Record<string, unknown>
  const cacheKey = `${ACCESSIBLE_NUCLEUS_IDS_CONTEXT_KEY}:${currentUser.id}:${currentUser.role}`
  const cached = context[cacheKey]

  if (Array.isArray(cached)) {
    return cached.filter((id): id is number => typeof id === 'number')
  }

  const collections = req.payload.collections as Record<string, unknown>
  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  let ids: NucleusID[] = []

  if (currentUser.role === 'coordenador' && collections.electoralNucleus) {
    const result = await find({
      collection: 'electoralNucleus',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { id: true },
      where: {
        coordinators: {
          contains: currentUser.id,
        },
      },
    })

    ids = result.docs.map((doc) => relationshipId(doc.id)).filter((id): id is number => id !== null)
  }

  if (currentUser.role === 'lideranca' && collections.leadership) {
    const result = await find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { nucleus: true },
      where: {
        and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
      },
    })

    ids = result.docs
      .map((doc) => relationshipId(doc.nucleus))
      .filter((id): id is number => id !== null)
  }

  const uniqueIDs = [...new Set(ids)]
  context[cacheKey] = uniqueIDs

  return uniqueIDs
}

export const canReadCampaignUserPhone: FieldAccess = async ({ doc, id, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (id !== undefined && String(id) === String(currentUser.id)) return true
  if (isCampaignGeneral(currentUser)) return true
  if (id === undefined) return false

  const targetUserID = Number(id)
  if (!Number.isInteger(targetUserID) || targetUserID <= 0) return false

  const context = req.context as Record<string, unknown>
  const cacheKey = `${CAMPAIGN_USER_PHONE_ACCESS_CONTEXT_KEY}:${currentUser.id}:${targetUserID}`
  if (typeof context[cacheKey] === 'boolean') return context[cacheKey]

  let targetRole =
    typeof doc === 'object' && doc !== null && 'role' in doc ? doc.role : undefined
  if (targetRole === undefined) {
    try {
      const target = await req.payload.findByID({
        collection: 'campaignUser',
        id: targetUserID,
        depth: 0,
        select: { role: true },
        overrideAccess: true,
        req,
      })
      targetRole = target.role
    } catch {
      // Missing target only — fall through to the coordinator-scope check.
    }
  }
  if (targetRole === 'geral') {
    context[cacheKey] = true
    return true
  }

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  if (!nucleusIDs?.length) {
    context[cacheKey] = false
    return false
  }

  const find = req.payload.find.bind(req.payload) as unknown as DynamicFind
  const result = await find({
    collection: 'electoralNucleus',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { id: true },
    where: {
      and: [{ id: { in: nucleusIDs } }, { coordinators: { contains: targetUserID } }],
    },
  })
  const allowed = result.docs.length > 0
  context[cacheKey] = allowed
  return allowed
}

export const canCreateCampaignUserPhone: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true
  return isCampaignGeneral(await getFreshCampaignUser(req))
}

export const canUpdateCampaignUserPhone: FieldAccess = async ({ id, req }) => {
  if (isPayloadAdmin(req.user)) return true

  const currentUser = await getFreshCampaignUser(req)
  if (!currentUser) return false
  if (id !== undefined && String(id) === String(currentUser.id)) return true
  return isCampaignGeneral(currentUser)
}

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

  const nucleusIDs = await getAccessibleNucleusIds(req, currentUser)
  const leadershipWhere =
    currentUser.role === 'lideranca'
      ? {
          and: [{ user: { equals: currentUser.id } }, { supportStatus: { equals: 'engajado' } }],
        }
      : {
          nucleus: {
            in: nucleusIDs ?? [],
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

  if (currentUser.role === 'coordenador' && collections.supporter) {
    const supporterResult = await find({
      collection: 'supporter',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { contact: true },
      where: {
        nucleus: {
          in: nucleusIDs ?? [],
        },
      },
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
