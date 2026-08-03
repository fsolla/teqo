import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { loadMunicipalityLeaderships } from '@/utilities/leadership/leadershipData'
import { resolveAccessibleMunicipalityContext } from '@/utilities/municipality/municipalityPageData'
import {
  buildMunicipalityV2NetworkRows,
  type MunicipalityV2NetworkViewModel,
} from '@/utilities/municipality/municipalityV2NetworkView'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'

export type { MunicipalityV2NetworkViewModel }

export const loadMunicipalityV2NetworkData = async (
  payload: Payload,
  user: CampaignUser,
  municipalitySlug: string,
): Promise<MunicipalityV2NetworkViewModel> => {
  const context = await resolveAccessibleMunicipalityContext(payload, user, municipalitySlug)
  const [leaderships, pledges] = await Promise.all([
    loadMunicipalityLeaderships(payload, user, context.id),
    loadMunicipalityPledges(payload, user, context.id),
  ])

  const { rows, totalCount } = buildMunicipalityV2NetworkRows(
    leaderships.map((leadership) => ({
      id: leadership.id,
      name: leadership.name,
      supportStatus: leadership.supportStatus,
    })),
    pledges.map((pledge) => ({
      id: pledge.id,
      leadershipID: pledge.leadershipID,
      declaredVotes: pledge.declaredVotes,
      estimatedVotes: pledge.estimatedVotes,
    })),
  )

  return {
    municipalityID: context.id,
    slug: context.slug,
    rows,
    totalCount,
  }
}
