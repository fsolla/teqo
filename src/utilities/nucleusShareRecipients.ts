import type { Payload } from 'payload'

import type { CampaignUser, Contact } from '@/payload-types'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export type NucleusShareRecipient = {
  id: number
  name: string
  phone: string
}

export type NucleusShareRecipients = {
  general: NucleusShareRecipient[]
  coordinators: NucleusShareRecipient[]
  leaderships: NucleusShareRecipient[]
}

type CampaignUserShareDoc = {
  id: number
  name: string
  phone?: string | null
}

type LeadershipShareDoc = {
  id: number
  contact?: number | Contact | null
}

const emptyCampaignUserDocs: CampaignUserShareDoc[] = []
const emptyLeadershipDocs: LeadershipShareDoc[] = []

const toCampaignUserRecipient = (doc: CampaignUserShareDoc): NucleusShareRecipient | null =>
  typeof doc.phone === 'string' && doc.phone.length > 0
    ? { id: doc.id, name: doc.name, phone: doc.phone }
    : null

const toLeadershipRecipient = (doc: LeadershipShareDoc): NucleusShareRecipient | null => {
  if (!isPopulatedRelationship<Contact>(doc.contact)) return null
  if (typeof doc.contact.phone !== 'string' || doc.contact.phone.length === 0) return null
  return {
    id: doc.id,
    name: doc.contact.name,
    phone: doc.contact.phone,
  }
}

export const getNucleusShareRecipients = async (
  payload: Payload,
  user: CampaignUser,
  slug: string,
): Promise<NucleusShareRecipients> => {
  const nucleusResult = await payload.find({
    collection: 'electoralNucleus',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { coordinators: true },
    user,
    overrideAccess: false,
  })
  const nucleus = nucleusResult.docs[0]
  if (!nucleus) throw new Error('Núcleo não encontrado ou sem acesso.')

  const coordinatorIds = (nucleus.coordinators ?? [])
    .map((coordinator) => relationshipId(coordinator))
    .filter((id): id is number => id !== null)

  // Privileged reads after the nucleus gate: avoids N+1 field-access phone checks
  // while still only returning the share sections for a nucleus the actor can open.
  const [generalResult, coordinatorsResult, leadershipsResult] = await Promise.all([
    payload.find({
      collection: 'campaignUser',
      where: { role: { equals: 'geral' } },
      depth: 0,
      pagination: false,
      sort: 'name',
      select: { name: true, phone: true },
      overrideAccess: true,
    }),
    coordinatorIds.length === 0
      ? Promise.resolve({ docs: emptyCampaignUserDocs })
      : payload.find({
          collection: 'campaignUser',
          where: {
            and: [{ id: { in: coordinatorIds } }, { role: { equals: 'coordenador' } }],
          },
          depth: 0,
          pagination: false,
          sort: 'name',
          select: { name: true, phone: true },
          overrideAccess: true,
        }),
    user.role === 'lideranca'
      ? Promise.resolve({ docs: emptyLeadershipDocs })
      : payload.find({
          collection: 'leadership',
          where: {
            and: [
              { nucleus: { equals: nucleus.id } },
              { supportStatus: { equals: 'engajado' } },
            ],
          },
          depth: 1,
          pagination: false,
          sort: 'id',
          select: { contact: true },
          overrideAccess: true,
        }),
  ])

  return {
    general: generalResult.docs
      .map(toCampaignUserRecipient)
      .filter((recipient): recipient is NucleusShareRecipient => recipient !== null),
    coordinators: coordinatorsResult.docs
      .map(toCampaignUserRecipient)
      .filter((recipient): recipient is NucleusShareRecipient => recipient !== null),
    leaderships: leadershipsResult.docs
      .map(toLeadershipRecipient)
      .filter((recipient): recipient is NucleusShareRecipient => recipient !== null),
  }
}
