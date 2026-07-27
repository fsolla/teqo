import 'server-only'

import { cache } from 'react'

import type { Payload, Where } from 'payload'

import { isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser, Municipality } from '@/payload-types'
import {
  aggregateAllPledgesByMunicipality,
  aggregatePledgesByMunicipality,
} from '@/utilities/votePledgeData'
import { type MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

/** Superset of the fields the dashboard, map, and list overview consume. */
type ScopedMunicipalityDoc = Pick<
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
  const municipalitiesPromise = payload
    .find({
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
    .then((result) => result.docs as ScopedMunicipalityDoc[])

  // An unrestricted actor with no filter has the WHOLE catalog in scope, so the
  // pledge aggregate has nothing to narrow: both reads can leave in the same
  // round trip. Every narrower scope still has to wait for the município ids —
  // the aggregate would otherwise count pledges the actor cannot read.
  if (isUnrestrictedCampaignRole(user.role) && Object.keys(where).length === 0) {
    const [municipalities, pledgeAggregates] = await Promise.all([
      municipalitiesPromise,
      aggregateAllPledgesByMunicipality(payload),
    ])

    return { municipalities, pledgeAggregates }
  }

  const municipalities = await municipalitiesPromise
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
