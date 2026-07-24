'use server'

import type { Payload } from 'payload'

import {
  stateDeputyCreateSchema,
  stateDeputyUpdateSchema,
  type StateDeputyCreateInput,
  type StateDeputyUpdateInput,
} from '@/lib/schemas/stateDeputy'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

const assertStaffActor = (payload: Payload, actor: CampaignUser): Promise<CampaignUser> =>
  reloadStaffActor(payload, actor, 'Somente a coordenação e a assessoria gerenciam dobradinhas.')

const isUniqueStateDeputyConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /state_deputy_(name|slug)|duplicate key/i.test(message)
}

export const createStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyCreateInput,
) => {
  const data = stateDeputyCreateSchema.parse(input)
  const currentActor = await assertStaffActor(payload, actor)

  try {
    return await payload.create({
      collection: 'stateDeputy',
      data: hookFilledCreateData<'stateDeputy'>(data),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    })
  } catch (error) {
    if (isUniqueStateDeputyConflict(error)) {
      throw new Error('Já existe uma dobradinha com este nome.')
    }
    throw error
  }
}

export const updateStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyUpdateInput,
) => {
  const { id, ...data } = stateDeputyUpdateSchema.parse(input)
  const currentActor = await assertStaffActor(payload, actor)

  return payload.update({
    collection: 'stateDeputy',
    id,
    data,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const createStateDeputy = async (input: StateDeputyCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createStateDeputyRecord(payload, actor, input)
}

export const updateStateDeputy = async (input: StateDeputyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateStateDeputyRecord(payload, actor, input)
}
