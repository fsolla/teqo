import 'server-only'

import { cache } from 'react'

import type { Payload, Where } from 'payload'

import type { CampaignUser, Municipality } from '@/payload-types'
import {
  aggregatePledgesByMunicipality,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeData'

/** Superset of the fields the dashboard, map, and list overview consume. */
export type ScopedMunicipalityDoc = Pick<
  Municipality,
  | 'id'
  | 'name'
  | 'slug'
  | 'kind'
  | 'region'
  | 'ibgeCode'
  | 'advisors'
  | 'priority'
  | 'expectedVotes'
>

export type MunicipalityScope = {
  municipalities: ScopedMunicipalityDoc[]
  pledgeAggregates: Map<number, MunicipalityPledgeAggregate>
}

const loadScope = async (
  payload: Payload,
  user: CampaignUser,
  where: Where,
): Promise<MunicipalityScope> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      name: true,
      slug: true,
      kind: true,
      region: true,
      ibgeCode: true,
      advisors: true,
      priority: true,
      expectedVotes: true,
    },
    where,
    user,
    overrideAccess: false,
  })

  const municipalities = result.docs as ScopedMunicipalityDoc[]
  const pledgeAggregates = await aggregatePledgesByMunicipality(
    payload,
    municipalities.map((municipality) => municipality.id),
  )

  return { municipalities, pledgeAggregates }
}

/**
 * Request-scoped municipality scope (accessible docs + pledge aggregates),
 * deduplicated with React `cache()`: the staff dashboard and the map bundle
 * both need the same scope on one request and used to load it twice.
 *
 * `payload` (module singleton) and `user` (from the request-cached
 * `getCampaignUser`) are reference-stable within a request; the `where` clause
 * participates via its canonical JSON string.
 */
const loadScopeCached = cache((payload: Payload, user: CampaignUser, whereKey: string) =>
  loadScope(payload, user, JSON.parse(whereKey) as Where),
)

export const loadMunicipalityScope = (
  payload: Payload,
  user: CampaignUser,
  where: Where,
): Promise<MunicipalityScope> => loadScopeCached(payload, user, JSON.stringify(where))
