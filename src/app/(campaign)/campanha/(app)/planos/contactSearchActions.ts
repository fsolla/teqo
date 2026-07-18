'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { getCampaignUser } from '@/utilities/campaignAuth'

export type ActionPlanContactOption = {
  id: number
  name: string
  phone: string
}

const CONTACT_OPTION_LIMIT = 20

export const searchActionPlanContactOptions = async (
  query: string,
): Promise<ActionPlanContactOption[]> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user) throw new Error('Autenticação necessária.')

  const trimmed = typeof query === 'string' ? query.trim().slice(0, 120) : ''
  const digits = trimmed.replace(/\D/g, '')

  const result = await payload.find({
    collection: 'contact',
    where: trimmed
      ? {
          or: [{ name: { contains: trimmed } }, { phone: { contains: digits || trimmed } }],
        }
      : {},
    depth: 0,
    limit: CONTACT_OPTION_LIMIT,
    page: 1,
    sort: 'name',
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })

  return result.docs.map(({ id, name, phone }) => ({ id, name, phone }))
}
