'use server'

import type { Payload } from 'payload'

import {
  stateDeputyCreateSchema,
  stateDeputyUpdateSchema,
  type StateDeputyCreateInput,
  type StateDeputyUpdateInput,
} from '@/lib/schemas/stateDeputy'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { runStaffEntityMutation, type StaffEntityPolicy } from '@/utilities/campaignEntityActions'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

const stateDeputyPolicy: StaffEntityPolicy = {
  staffMessage: 'Somente a coordenação e a assessoria gerenciam dobradinhas.',
  conflictPattern: /state_deputy_(name|slug)|duplicate key/i,
  conflictMessage: 'Já existe uma dobradinha com este nome.',
}

export const createStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyCreateInput,
) => {
  const data = stateDeputyCreateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, stateDeputyPolicy, (currentActor) =>
    payload.create({
      collection: 'stateDeputy',
      data: hookFilledCreateData<'stateDeputy'>(data),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

export const updateStateDeputyRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: StateDeputyUpdateInput,
) => {
  const { id, ...data } = stateDeputyUpdateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, stateDeputyPolicy, (currentActor) =>
    payload.update({
      collection: 'stateDeputy',
      id,
      data,
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

export const createStateDeputy = async (input: StateDeputyCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createStateDeputyRecord(payload, actor, input)
}

export const updateStateDeputy = async (input: StateDeputyUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateStateDeputyRecord(payload, actor, input)
}
