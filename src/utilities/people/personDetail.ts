import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { CampaignUser, Leadership, StateDeputy, Supporter } from '@/payload-types'
import { municipalityIdsByAdvisorIds } from '@/utilities/advisorData'
import { getAdvisorMunicipalityIds, isCampaignStaff } from '@/utilities/campaignAccess'
import { loadCampaignUserNamesByIds } from '@/utilities/loadNamesByIds'
import {
  mergePeopleSources,
  resolveAssessorados,
  scopePeopleRows,
  toPeopleDeputySource,
  toPeopleLeadershipSource,
  toPeopleRowViewModel,
  toPeopleStaffSource,
  type PeopleRowViewModel,
} from '@/utilities/people/peopleData'
import { buildPeopleStaffSourceWhere } from '@/utilities/people/peopleListUrl'
import { municipalityIdsByStateDeputyIds } from '@/utilities/stateDeputyData'

/**
 * The person detail (C118): the same merge-by-`Contact` as the unified list,
 * narrowed to ONE ficha, plus the supporter records that the list row does not
 * carry. The scope contract is the LIST'S, verbatim — `scopePeopleRows` with
 * the advisor's carteira — so a detail can never show a person the list would
 * not: an advisor opens only people with at least one capacity municipality in
 * her carteira, unrestricted actors open anyone with any role.
 *
 * The staff source reads with the same justified `overrideAccess` as
 * `loadPeopleListPageData` (the `contact` field is identity-gated and would be
 * cut from the depth-1 populate otherwise); the merge is what proves the
 * actor's scope. The supporter read goes through the collection's own access
 * (`overrideAccess: false`) — a second, narrower layer, never a widening one:
 * an advisor sees only supporter rows in her municipalities.
 *
 * Municipality names are NOT resolved here: the page renders every section
 * through the shared portfolio index (same "ids only" contract as the list
 * columns), so there is one source of truth for names.
 */
type PersonSupporterSummary = {
  id: number
  source: Supporter['source']
  municipalityID: number | null
  voteIntention: SupporterVoteIntention | null
  hasVoteIntentionConsent: boolean
  createdAt: string
}

export type PersonDetailViewModel = PeopleRowViewModel & {
  supporters: PersonSupporterSummary[]
}

const supporterDetailSelect = {
  source: true,
  municipality: true,
  voteIntention: true,
  voteIntentionConsentedAt: true,
  createdAt: true,
} as const

export const loadPersonDetail = async (
  payload: Payload,
  user: CampaignUser,
  contactID: number,
): Promise<PersonDetailViewModel | null> => {
  if (!isCampaignStaff(user)) return null

  const [leadershipResult, deputyResult, staffResult, supporterResult] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { contact: { equals: contactID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: {
        contact: true,
        municipalities: true,
        advisors: true,
        supportStatus: true,
        user: true,
      },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'stateDeputy',
      where: { contact: { equals: contactID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true, slug: true, party: true, ballotName: true, advisors: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'campaignUser',
      // The list's own staff where (`role in advisor|coordinator|candidate` +
      // `contact exists`) — a leader account linked to the ficha must never
      // light the Assessora capacity here, exactly as it never does in the list.
      where: {
        and: [buildPeopleStaffSourceWhere({ page: 1 }), { contact: { equals: contactID } }],
      },
      depth: 1,
      limit: 0,
      pagination: false,
      select: { name: true, role: true, contact: true },
      // Same justified bypass as `loadPeopleListPageData`: `contact` is
      // identity-gated and the merge below proves the actor's scope.
      overrideAccess: true,
    }),
    payload.find({
      collection: 'supporter',
      where: { contact: { equals: contactID } },
      depth: 1,
      limit: 0,
      pagination: false,
      select: supporterDetailSelect,
      user,
      overrideAccess: false,
    }),
  ])

  const [deputyMunicipalityIdsByDeputy, staffMunicipalityIdsByStaff] = await Promise.all([
    municipalityIdsByStateDeputyIds(
      payload,
      deputyResult.docs.map((doc) => doc.id),
    ),
    municipalityIdsByAdvisorIds(
      payload,
      staffResult.docs.map((doc) => doc.id),
    ),
  ])

  const leaderships = (leadershipResult.docs as Leadership[]).map(toPeopleLeadershipSource)

  const deputies = (deputyResult.docs as StateDeputy[]).map((doc) =>
    toPeopleDeputySource(doc, deputyMunicipalityIdsByDeputy),
  )

  const staff = (staffResult.docs as CampaignUser[]).map((doc) =>
    toPeopleStaffSource(doc, staffMunicipalityIdsByStaff),
  )

  const merged = mergePeopleSources({ leaderships, deputies, staff })
  const accessibleMunicipalityIds =
    user.role === 'advisor' ? new Set(await getAdvisorMunicipalityIds(payload, user.id)) : null
  const [person] = scopePeopleRows(merged, accessibleMunicipalityIds)
  if (!person) return null

  const advisorIDs = [...new Set([...person.leadershipAdvisorIDs, ...person.deputyAdvisorIDs])]
  const advisorNames = await loadCampaignUserNamesByIds(payload, advisorIDs)
  const assessorados = resolveAssessorados(advisorIDs, advisorNames)

  const supporters: PersonSupporterSummary[] = (supporterResult.docs as Supporter[]).map((doc) => ({
    id: doc.id,
    source: doc.source,
    municipalityID: relationshipId(doc.municipality),
    voteIntention: doc.voteIntention ?? null,
    hasVoteIntentionConsent: Boolean(doc.voteIntentionConsentedAt),
    createdAt: doc.createdAt,
  }))

  return {
    ...toPeopleRowViewModel(person, assessorados),
    supporters,
  }
}
