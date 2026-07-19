import type { Payload } from 'payload'

import type { CampaignUser, User } from '@/payload-types'
import { loadBaseline2022VotesByCityNames } from '@/utilities/nucleusElectoralBaseline'
import {
  buildNucleusChoroplethBundleFromResolved,
  resolveChoroplethNuclei,
  type NucleusChoroplethBundle,
  type NucleusChoroplethNucleus,
} from '@/utilities/nucleusChoropleth'

type ChoroplethReader = CampaignUser | User

export const loadNucleusChoroplethBundle = async (
  payload: Pick<Payload, 'find'>,
  user: ChoroplethReader,
  nuclei: readonly NucleusChoroplethNucleus[],
): Promise<NucleusChoroplethBundle> => {
  const resolved = resolveChoroplethNuclei(nuclei)
  const cityNames = [
    ...new Set(resolved.flatMap(({ cities }) => cities)),
  ]
  const baselineVotesByCity =
    cityNames.length > 0
      ? await loadBaseline2022VotesByCityNames(payload, user, cityNames)
      : new Map<string, number>()

  return buildNucleusChoroplethBundleFromResolved(resolved, baselineVotesByCity)
}
