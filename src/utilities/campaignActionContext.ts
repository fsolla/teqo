import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff, isCampaignUnrestricted } from '@/utilities/campaignAccess'
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

/**
 * Reloads the actor's fresh role and asserts they are campaign staff
 * (coordinator, advisor, or candidate — matching collection-level access via
 * `isCampaignStaff`). Throws `errorMessage` otherwise.
 */
export const reloadStaffActor = async (
  payload: CampaignActorPayload,
  actor: CampaignUser,
  errorMessage: string,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  if (!isCampaignStaff(currentActor)) throw new Error(errorMessage)
  return currentActor
}

/**
 * Reloads the actor's fresh role and asserts they are the coordinator.
 * Throws `errorMessage` otherwise.
 */
export const reloadCoordinatorActor = async (
  payload: CampaignActorPayload,
  actor: CampaignUser,
  errorMessage: string,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  if (currentActor.role !== 'coordinator') throw new Error(errorMessage)
  return currentActor
}

/**
 * Reloads the actor's fresh role and asserts they are unrestricted
 * (coordinator or candidate). Throws `errorMessage` otherwise.
 */
export const reloadUnrestrictedActor = async (
  payload: CampaignActorPayload,
  actor: CampaignUser,
  errorMessage: string,
  req?: PayloadTransactionRequest,
): Promise<CampaignUser> => {
  const currentActor = await reloadCampaignActor(payload, actor, req)
  if (!isCampaignUnrestricted(currentActor)) throw new Error(errorMessage)
  return currentActor
}

export const getCampaignActionContext = async (): Promise<CampaignActionContext> => {
  const [payload, actor] = await Promise.all([getPayload({ config }), requireCampaignUser()])
  return { payload, actor }
}
