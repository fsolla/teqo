import type { Payload, Where } from 'payload'

import type { CampaignUser, Contact } from '@/payload-types'
import type { AccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { relationshipId } from '@/utilities/relationship'

export const primaryContactOptionLimit = 100

export type PrimaryContactOption = {
  id: number
  name: string
  phone: string
}

export type NucleusPrimaryContactPageData = {
  current: PrimaryContactOption | null
  options: PrimaryContactOption[]
}

const toPrimaryContactOption = (contact: Contact | undefined): PrimaryContactOption | null => {
  if (!contact) return null
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
  }
}

export const getNucleusPrimaryContactPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleNucleusContext,
): Promise<NucleusPrimaryContactPageData> => {
  if (user.role === 'lideranca') return { current: null, options: [] }

  const currentContact = context.document.primaryContact
  const currentContactId = relationshipId(currentContact)
  if (currentContactId === null) return { current: null, options: [] }

  const currentResult = await payload.find({
    collection: 'contact',
    where: { id: { equals: currentContactId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })

  return {
    current: toPrimaryContactOption(currentResult.docs[0] as Contact | undefined),
    options: [],
  }
}

export const searchNucleusPrimaryContactOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  context: AccessibleNucleusContext,
  rawQuery: string,
): Promise<NucleusPrimaryContactPageData> => {
  if (user.role === 'lideranca') {
    throw new Error('Somente a coordenação pode buscar contatos principais.')
  }

  const { current } = await getNucleusPrimaryContactPageData(payload, user, context)
  const query = rawQuery.trim().slice(0, 120)
  const digits = query.replace(/\D/g, '')
  const filters: Where[] = [
    { nucleus: { equals: context.id } },
    { supportStatus: { equals: 'engajado' } },
  ]
  if (query) {
    filters.push({
      or: [
        { 'contact.name': { contains: query } },
        { 'contact.phone': { contains: digits || query } },
      ],
    })
  }

  const optionLimit = current ? primaryContactOptionLimit - 1 : primaryContactOptionLimit
  const leadershipResult = await payload.find({
    collection: 'leadership',
    where: { and: filters },
    depth: 0,
    limit: primaryContactOptionLimit,
    page: 1,
    sort: 'contact.name',
    select: { contact: true },
    user,
    overrideAccess: false,
  })
  const contactIds = [
    ...new Set(
      leadershipResult.docs
        .map(({ contact }) => relationshipId(contact))
        .filter((id): id is number => id !== null && id !== current?.id),
    ),
  ].slice(0, optionLimit)
  if (contactIds.length === 0) return { current, options: [] }

  const contactsResult = await payload.find({
    collection: 'contact',
    where: { id: { in: contactIds } },
    depth: 0,
    limit: optionLimit,
    pagination: false,
    sort: 'name',
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })
  const options = contactsResult.docs
    .flatMap((contact) => {
      const option = toPrimaryContactOption(contact as Contact)
      return option ? [option] : []
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    .slice(0, optionLimit)

  return { current, options }
}
