'use server'

import type { Payload } from 'payload'

import {
  organizationCreateSchema,
  organizationUpdateSchema,
  type OrganizationCreateInput,
  type OrganizationUpdateInput,
} from '@/lib/schemas/organization'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

const assertStaffActor = (payload: Payload, actor: CampaignUser): Promise<CampaignUser> =>
  reloadStaffActor(payload, actor, 'Somente a coordenação e a assessoria gerenciam organizações.')

const isUniqueOrganizationConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /organization_(name|slug)|duplicate key/i.test(message)
}

export const createOrganizationRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: OrganizationCreateInput,
) => {
  const data = organizationCreateSchema.parse(input)
  const currentActor = await assertStaffActor(payload, actor)

  try {
    return await payload.create({
      collection: 'organization',
      data: hookFilledCreateData<'organization'>(data),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    })
  } catch (error) {
    if (isUniqueOrganizationConflict(error)) {
      throw new Error('Já existe uma organização com este nome.')
    }
    throw error
  }
}

export const updateOrganizationRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: OrganizationUpdateInput,
) => {
  const { id, ...data } = organizationUpdateSchema.parse(input)
  const currentActor = await assertStaffActor(payload, actor)

  return payload.update({
    collection: 'organization',
    id,
    data,
    depth: 0,
    user: currentActor,
    overrideAccess: false,
  })
}

export const createOrganization = async (input: OrganizationCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createOrganizationRecord(payload, actor, input)
}

export const updateOrganization = async (input: OrganizationUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateOrganizationRecord(payload, actor, input)
}
