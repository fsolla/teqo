// ---------------------------------------------------------------------------
// Election data
// ---------------------------------------------------------------------------

import type { CampaignUser, User } from '@/payload-types'
import type { Access } from 'payload'

import type { CampaignActor } from '@/utilities/access/shared'
import { isCampaignStaff, isPayloadAdmin } from '@/utilities/access/shared'

export type ElectionDataReader = CampaignUser | User

const canReadElectionDataAsUser = (user: CampaignActor): user is ElectionDataReader =>
  isPayloadAdmin(user) || isCampaignStaff(user)

export function assertCanReadElectionData(user: CampaignActor): asserts user is ElectionDataReader {
  if (!canReadElectionDataAsUser(user)) {
    throw new Error('Leitura de dados eleitorais negada.')
  }
}

/** Public TSE election data: any authenticated campaign or admin user may read. */
export const canReadElectionData: Access = ({ req }) => canReadElectionDataAsUser(req.user)

/** Election reference data is mutated only by Payload admins (or CLI with overrideAccess). */
export const canMutateElectionData: Access = ({ req }) => isPayloadAdmin(req.user)
