import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { getCampaignInviteConsentState } from '@/utilities/campaignInvitePageData'
import {
  getNucleusLeadershipPageData,
  getSelectedNucleusLeadershipPageData,
} from '@/utilities/leadershipPageData'
import { parseLeadershipFilterState, parseLeadershipPanelState } from '@/utilities/leadershipUi'
import { getNucleusCoordinatorAssignmentPageData } from '@/utilities/nucleusCoordinatorAssignmentPageData'
import { getNucleusElectoralBaseline } from '@/utilities/nucleusElectoralBaseline'
import { toNucleusElectionGeographyInput } from '@/utilities/nucleusElectionGeography'
import {
  getNucleusDetailPageData,
  resolveAccessibleNucleusContext,
} from '@/utilities/nucleusPageData'
import { getNucleusPrimaryContactPageData } from '@/utilities/primaryContactPageData'
import {
  getNucleusUpdatesPreviewData,
  getNucleusUpdatesPageData,
} from '@/utilities/nucleusUpdatePageData'
import { parseNucleusUpdateListState } from '@/utilities/nucleusUpdateUi'
import type { NucleusDetailSearchParams, NucleusDetailTab } from '@/utilities/nucleusDetailTabUi'

export const loadNucleusDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  nucleusSlug: string,
  activeTab: NucleusDetailTab,
) => {
  const context = await resolveAccessibleNucleusContext(payload, user, nucleusSlug, activeTab)
  const view = getNucleusDetailPageData(context, user)
  const coordinatorAssignment = await getNucleusCoordinatorAssignmentPageData(
    payload,
    user,
    context,
  )

  return {
    context,
    view,
    coordinatorAssignment,
  }
}

export const loadNucleusActiveTabPageData = async (
  payload: Payload,
  user: CampaignUser,
  context: Awaited<ReturnType<typeof resolveAccessibleNucleusContext>>,
  activeTab: NucleusDetailTab,
  searchParams: NucleusDetailSearchParams,
) => {
  if (activeTab === 'overview') {
    const [primaryContactPageData, updatePreview, baseline] = await Promise.all([
      getNucleusPrimaryContactPageData(payload, user, context),
      getNucleusUpdatesPreviewData(payload, user, context),
      getNucleusElectoralBaseline(payload, user, toNucleusElectionGeographyInput(context.document)),
    ])
    return { tab: activeTab, primaryContactPageData, updatePreview, baseline } as const
  }

  if (activeTab === 'leaderships') {
    const panelState = parseLeadershipPanelState(searchParams, user.role)
    const [leadershipPageData, inviteConsentState, selectedLeadership] = await Promise.all([
      getNucleusLeadershipPageData(
        payload,
        user,
        context,
        parseLeadershipFilterState(searchParams),
      ),
      user.role === 'lideranca'
        ? Promise.resolve({ configured: false })
        : getCampaignInviteConsentState(payload),
      panelState.mode === 'view' || panelState.mode === 'edit'
        ? getSelectedNucleusLeadershipPageData(payload, user, context, panelState.leadershipId)
        : Promise.resolve(null),
    ])
    return {
      tab: activeTab,
      leadershipPageData,
      inviteConsentState,
      panelState,
      selectedLeadership,
    } as const
  }

  if (activeTab === 'updates') {
    const updatesPageData = await getNucleusUpdatesPageData(
      payload,
      user,
      context,
      parseNucleusUpdateListState(searchParams),
    )
    return { tab: activeTab, updatesPageData } as const
  }

  return { tab: activeTab } as const
}
