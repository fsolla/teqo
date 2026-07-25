'use server'

import type { Payload } from 'payload'

import {
  organizationCreateSchema,
  organizationUpdateSchema,
  type OrganizationCreateInput,
  type OrganizationUpdateInput,
} from '@/lib/schemas/organization'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { runStaffEntityMutation, type StaffEntityPolicy } from '@/utilities/campaignEntityActions'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

const organizationPolicy: StaffEntityPolicy = {
  staffMessage: 'Somente a coordenação e a assessoria gerenciam organizações.',
  conflictPattern: /organization_(name|slug)|duplicate key/i,
  conflictMessage: 'Já existe uma organização com este nome.',
}

const createOrganizationRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: OrganizationCreateInput,
) => {
  const data = organizationCreateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, organizationPolicy, (currentActor) =>
    payload.create({
      collection: 'organization',
      data: hookFilledCreateData<'organization'>(data),
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

const updateOrganizationRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: OrganizationUpdateInput,
) => {
  const { id, ...data } = organizationUpdateSchema.parse(input)
  return runStaffEntityMutation(payload, actor, organizationPolicy, (currentActor) =>
    payload.update({
      collection: 'organization',
      id,
      data,
      depth: 0,
      user: currentActor,
      overrideAccess: false,
    }),
  )
}

export const createOrganization = async (input: OrganizationCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createOrganizationRecord(payload, actor, input)
}

export const updateOrganization = async (input: OrganizationUpdateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return updateOrganizationRecord(payload, actor, input)
}
