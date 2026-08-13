import type { Payload } from 'payload'

/**
 * Municipality residue purge for the test fixtures — shared by the int
 * (`campaignFixtures.ts`) and e2e (`campaignE2EFixtures.ts`) suites.
 *
 * Deliberately VITEST-FREE: the e2e fixture imports this module inside the
 * Playwright process, and a vitest import there crashes at load time
 * (`TypeError: Cannot redefine property: Symbol($$jest-matchers-object)` from
 * `@vitest/expect` — OPS45/CI 2026-08-13).
 */

export type RelationshipValue = number | { id: number }

/**
 * Id of a relationship field at any depth.
 *
 * Specs use this instead of `relationshipId` from `src/utilities/relationship`
 * so an assertion never runs through the production helper it is checking, and
 * instead of `uniqueRelationshipIds`, which dedups — hiding a duplicated link.
 */
export function relationId(value: RelationshipValue): number
export function relationId(value: RelationshipValue | null | undefined): number | undefined
export function relationId(value: RelationshipValue | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  return typeof value === 'number' ? value : value.id
}

/** Order-preserving, non-deduping ids of a `hasMany` relationship field. */
export const relationIds = (values: readonly RelationshipValue[] | null | undefined): number[] =>
  (values ?? []).map((value) => relationId(value))

/**
 * D10 F1 / OPS45: delete CONTACT rows an aborted run orphaned (no other join
 * references them). Production `removeSupporterData` only anonymizes, so its
 * reference rule is a subset of what a DELETE needs: every join that can hold
 * a ficha must be checked — leadership/signature/subscription/supporter, the
 * C99 account link (`campaignUser.contact`) and the `stateDeputy` FK
 * (`ON DELETE RESTRICT`, so an unchecked deputy would make the delete throw).
 * Reimplemented here so the fixture never runs production code under test.
 */
const deleteOrphanedResidueContacts = async (
  payload: Payload,
  contactIDs: Array<number | undefined>,
): Promise<void> => {
  const uniqueIDs = [...new Set(contactIDs.filter((id): id is number => id !== undefined))]
  if (uniqueIDs.length === 0) return
  const [leadershipRefs, signatureRefs, subscriptionRefs, supporterRefs, accountRefs, deputyRefs] =
    await Promise.all([
      payload.find({
        collection: 'leadership',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'signature',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'subscription',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'supporter',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'campaignUser',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'stateDeputy',
        where: { contact: { in: uniqueIDs } },
        depth: 0,
        pagination: false,
      }),
    ])
  const referenced = new Set<number>()
  for (const doc of [
    ...leadershipRefs.docs,
    ...signatureRefs.docs,
    ...subscriptionRefs.docs,
    ...supporterRefs.docs,
    ...accountRefs.docs,
    ...deputyRefs.docs,
  ]) {
    const contactID = relationId(doc.contact)
    if (contactID !== undefined) referenced.add(contactID)
  }
  const orphanContactIDs = uniqueIDs.filter((id) => !referenced.has(id))
  if (orphanContactIDs.length > 0) {
    await payload.delete({
      collection: 'contact',
      where: { id: { in: orphanContactIDs } },
      depth: 0,
    })
  }
}

/**
 * Delete campaign rows attached to a freshly claimed municipality. The allocator
 * guarantees no OTHER live test owns this municipality, so anything found here is
 * residue from an aborted previous run that would poison count assertions.
 * Also deletes the CONTACT rows those residue supporters orphaned (D10 F1) and
 * the dobradinha residue (OPS45): deputies linked through
 * `municipality.stateDeputies`, their orphaned fichas, and the field itself.
 */
export const purgeMunicipalityResidue = async (
  payload: Payload,
  municipalityID: number,
): Promise<void> => {
  const [pledges, updates, demands, leaderships, supporters, activities, feeds] = await Promise.all(
    [
      payload.find({
        collection: 'votePledge',
        where: { municipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
        select: {},
      }),
      payload.find({
        collection: 'municipalityUpdate',
        where: { municipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
        select: {},
      }),
      payload.find({
        collection: 'campaignDemand',
        where: { municipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
        select: {},
      }),
      payload.find({
        collection: 'leadership',
        where: { municipalities: { in: [municipalityID] } },
        depth: 0,
        pagination: false,
        select: {},
      }),
      payload.find({
        collection: 'supporter',
        where: { municipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'activity',
        where: { municipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
        select: {},
      }),
      payload.find({
        collection: 'calendarFeed',
        where: { filterMunicipality: { equals: municipalityID } },
        depth: 0,
        pagination: false,
        select: {},
      }),
    ],
  )

  // Residue invites reference residue leaderships (FK), so they must be
  // found and deleted before the leaderships — otherwise the leadership
  // delete aborts and the residue poisons every later claim of this municipality.
  const leadershipIDs = leaderships.docs.map((doc) => doc.id)
  const invites =
    leadershipIDs.length > 0
      ? await payload.find({
          collection: 'campaignInvite',
          where: { leadership: { in: leadershipIDs } },
          depth: 0,
          pagination: false,
          select: {},
        })
      : { docs: [] }

  const deletions: Array<{
    collection:
      | 'campaignInvite'
      | 'votePledge'
      | 'municipalityUpdate'
      | 'campaignDemand'
      | 'leadership'
      | 'supporter'
      | 'activity'
      | 'calendarFeed'
    ids: number[]
  }> = [
    { collection: 'campaignInvite', ids: invites.docs.map((doc) => doc.id) },
    { collection: 'votePledge', ids: pledges.docs.map((doc) => doc.id) },
    { collection: 'municipalityUpdate', ids: updates.docs.map((doc) => doc.id) },
    { collection: 'campaignDemand', ids: demands.docs.map((doc) => doc.id) },
    { collection: 'activity', ids: activities.docs.map((doc) => doc.id) },
    { collection: 'calendarFeed', ids: feeds.docs.map((doc) => doc.id) },
    { collection: 'leadership', ids: leadershipIDs },
    { collection: 'supporter', ids: supporters.docs.map((doc) => doc.id) },
  ]
  for (const { collection, ids } of deletions) {
    if (ids.length === 0) continue
    await payload.delete({
      collection,
      where: { id: { in: ids } },
      depth: 0,
    })
  }

  // D10 F1: an aborted run leaves residue supporters AND their contact rows.
  // The supporters are gone above; delete the contacts they orphaned (no other
  // join references them) so the residue stops accumulating.
  await deleteOrphanedResidueContacts(
    payload,
    supporters.docs.map((doc) => relationId(doc.contact)),
  )

  // OPS45 — dobradinha residue: deputies linked through the freshly claimed
  // municipality's `stateDeputies` belong to the crashed run that claimed it
  // (the allocator contract rules out a live owner). Delete the deputies,
  // the fichas they orphaned, and clear the field so a later claim starts
  // clean. The deputy contacts are captured BEFORE the delete.
  const claimed = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { stateDeputies: true },
    overrideAccess: true,
  })
  const residueDeputyIDs = relationIds(claimed?.stateDeputies ?? [])
  if (residueDeputyIDs.length > 0) {
    const deputies = await payload.find({
      collection: 'stateDeputy',
      where: { id: { in: residueDeputyIDs } },
      depth: 0,
      pagination: false,
      select: { contact: true },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'stateDeputy',
      where: { id: { in: residueDeputyIDs } },
      depth: 0,
    })
    await deleteOrphanedResidueContacts(
      payload,
      deputies.docs.map((doc) => relationId(doc.contact)),
    )
    await payload.update({
      collection: 'municipality',
      id: municipalityID,
      data: { stateDeputies: [] },
      depth: 0,
      overrideAccess: true,
    })
  }
}
