'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

import { getCampaignUser } from '@/utilities/campaignAuth'
import { resolveAccessibleNucleusContext } from '@/utilities/nucleusPageData'
import {
  searchNucleusPrimaryContactOptions,
  type NucleusPrimaryContactPageData,
} from '@/utilities/primaryContactPageData'

export const searchPrimaryContactOptionsFormAction = async (
  nucleusSlug: string,
  query: string,
): Promise<NucleusPrimaryContactPageData> => {
  const [payload, user] = await Promise.all([getPayload({ config }), getCampaignUser()])
  if (!user || user.role === 'lideranca') {
    throw new Error('Somente a coordenação pode buscar contatos principais.')
  }

  const context = await resolveAccessibleNucleusContext(payload, user, nucleusSlug)
  return searchNucleusPrimaryContactOptions(
    payload,
    user,
    context,
    typeof query === 'string' ? query : '',
  )
}
