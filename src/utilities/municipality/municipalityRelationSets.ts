import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { CampaignUser, Leadership, StateDeputy } from '@/payload-types'
import {
  type MunicipalityListRelationCatalog,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'

/**
 * B176 — the request-scoped relation sets that turn the reverse
 * (`leadership.municipalities`) and cross (`stateDeputy.party`) filters into
 * municipality-level `where` clauses. State-independent, so a page loads it
 * ONCE and every facet variant + the page query + the map derive their own
 * subset — no N+1.
 *
 * Lazy by half with one exception: the leadership half is only read when a
 * leadership filter is active (the facets source their names from
 * `loadMunicipalityLeadershipSummaries`, not from here), while the party half
 * ALWAYS loads — besides the "Sem partido"/named-party `where` clauses it is
 * the facet's deputy→party inverse (`partyOfStateDeputyID`), which the Partido
 * option group reads even when no party filter is set. A no-filter visit pays
 * one small read instead of two.
 *
 * Scope: every read threads `user` + `overrideAccess: false`, so an advisor's
 * catalog only ever reaches the leaderships of the municípios they administer
 * (`canReadLeadership`); the dobradinha registry is staff-wide by design.
 */
export const loadMunicipalityListRelationCatalog = async (
  payload: Payload,
  user: CampaignUser,
  state: MunicipalityListState,
): Promise<MunicipalityListRelationCatalog> => {
  const needsLeadership = Boolean(state.leaderships?.length)

  const [leaderships, stateDeputies] = await Promise.all([
    needsLeadership
      ? payload.find({
          collection: 'leadership',
          depth: 0,
          limit: 0,
          pagination: false,
          select: { municipalities: true },
          where: { municipalities: { exists: true } },
          user,
          overrideAccess: false,
        })
      : null,
    payload.find({
      collection: 'stateDeputy',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { party: true },
      where: { party: { exists: true } },
      user,
      overrideAccess: false,
    }),
  ])

  const leadershipMunicipalityIDsByLeadership = new Map<number, number[]>()
  const allLeadershipMunicipalityIDs = new Set<number>()
  if (leaderships) {
    for (const doc of leaderships.docs as Leadership[]) {
      const leadershipID = relationshipId(doc.id)
      if (leadershipID === null) continue
      const municipalityIDs = (doc.municipalities ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
      leadershipMunicipalityIDsByLeadership.set(leadershipID, municipalityIDs)
      for (const id of municipalityIDs) allLeadershipMunicipalityIDs.add(id)
    }
  }

  const stateDeputyIDsByParty = new Map<string, number[]>()
  const allPartyStateDeputyIDs = new Set<number>()
  if (stateDeputies) {
    for (const doc of stateDeputies.docs as StateDeputy[]) {
      if (!doc.party) continue
      const stateDeputyID = relationshipId(doc.id)
      if (stateDeputyID === null) continue
      const idsByParty = stateDeputyIDsByParty.get(doc.party) ?? []
      idsByParty.push(stateDeputyID)
      stateDeputyIDsByParty.set(doc.party, idsByParty)
      allPartyStateDeputyIDs.add(stateDeputyID)
    }
  }

  return {
    leadershipMunicipalityIDsByLeadership,
    allLeadershipMunicipalityIDs,
    stateDeputyIDsByParty,
    allPartyStateDeputyIDs,
  }
}
