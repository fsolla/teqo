'use server'

import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

import {
  CAMPAIGN_LIST_LOAD_ERROR_MESSAGE,
  CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE,
  type CampaignListNextPageResult,
} from '@/lib/campaignListPage'
import {
  ORGANIZATION_CONFLICT_MESSAGE,
  ORGANIZATION_STAFF_MESSAGE,
  organizationCreateSchema,
  organizationUpdateSchema,
  type OrganizationCreateInput,
  type OrganizationUpdateInput,
} from '@/lib/schemas/organization'
import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignActionContext } from '@/utilities/campaignActionContext'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { runStaffEntityMutation, type StaffEntityPolicy } from '@/utilities/campaignEntityActions'
import { rawSearchParamsFromQueryString, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { parseOrganizationListParams } from '@/utilities/organization/organizationListUrl'
import {
  loadOrganizationListPageData,
  type OrganizationRowViewModel,
} from '@/utilities/organizationData'

const organizationPolicy: StaffEntityPolicy = {
  staffMessage: ORGANIZATION_STAFF_MESSAGE,
  conflictPattern: /organization_(name|slug)|duplicate key/i,
  conflictMessage: ORGANIZATION_CONFLICT_MESSAGE,
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

/**
 * B161 — incremental load for the continuous list (see demand.ts twin).
 */
export const fetchNextOrganizationListPage = async (
  query: string,
  page: number,
): Promise<CampaignListNextPageResult<OrganizationRowViewModel>> => {
  const nextPage = strictDecimalInteger(String(page))
  if (!nextPage || nextPage < 2) {
    return { status: 'error', message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE }
  }

  const actor = await getCampaignUser()
  if (!actor) return { status: 'error', message: CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE }
  if (!isCampaignStaff(actor)) return { status: 'error', message: CAMPAIGN_LIST_LOAD_ERROR_MESSAGE }

  const payload = await getPayload({ config })
  const state = parseOrganizationListParams(rawSearchParamsFromQueryString(query))
  const { rows, totalDocs, totalPages } = await loadOrganizationListPageData(
    payload,
    actor,
    state,
    nextPage,
  )

  return { status: 'ok', rows, totalDocs, hasMore: nextPage < totalPages }
}
