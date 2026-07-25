import type { Field } from 'payload'

import { voteEstimateScenarioLabels } from '@/lib/voteEstimate'
import { canManageCampaignStaffField, canReadCampaignStaffField } from '@/utilities/campaignAccess'

/** Shared staff-only trio for pledge estimates and municipality expected totals. */
export const voteEstimateScenarioGroupFields = (): Field[] => [
  {
    name: 'pessimistic',
    type: 'number',
    label: voteEstimateScenarioLabels.pessimistic,
    min: 0,
  },
  {
    name: 'central',
    type: 'number',
    label: voteEstimateScenarioLabels.central,
    min: 0,
  },
  {
    name: 'optimistic',
    type: 'number',
    label: voteEstimateScenarioLabels.optimistic,
    min: 0,
  },
]

export const voteEstimateScenarioGroupAccess = {
  read: canReadCampaignStaffField,
  create: canManageCampaignStaffField,
  update: canManageCampaignStaffField,
} as const
