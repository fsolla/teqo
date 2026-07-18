import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { getCampaignUser } from '@/utilities/campaignAuth'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

export type CampaignActionContext = {
  payload: Payload
  actor: CampaignUser
}

type CampaignUserGetter = () => Promise<CampaignUser | null>
type CampaignActorPayload = Pick<Payload, 'findByID'>

export const requireCampaignUser = async (
  getUser: CampaignUserGetter = getCampaignUser,
): Promise<CampaignUser> => {
  const actor = await getUser()
  if (!actor) throw new Error('Autenticação necessária.')
  return actor
}

export const reloadCampaignActor = (
  payload: CampaignActorPayload,
  actor: CampaignUser,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> =>
  payload.findByID({
    collection: 'campaignUser',
    id: actor.id,
    depth: 0,
    // Intentional admin bypass: this is the trusted fresh-role reload used before authorization.
    overrideAccess: true,
    req,
  })

export const getCampaignActionContext = async (): Promise<CampaignActionContext> => {
  const [payload, actor] = await Promise.all([getPayload({ config }), requireCampaignUser()])
  return { payload, actor }
}
