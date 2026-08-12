import 'server-only'

import type { Payload } from 'payload'

import { primaryPhoneOf } from '@/lib/phone'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
import type { CampaignUser, Contact, Leadership, StateDeputy } from '@/payload-types'
import { municipalityIdsByAdvisorIds } from '@/utilities/advisorData'
import { getAdvisorMunicipalityIds, isCampaignStaff } from '@/utilities/campaignAccess'
import { loadCampaignUserNamesByIds } from '@/utilities/loadNamesByIds'
import {
  buildPeopleDeputySourceWhere,
  buildPeopleLeadershipSourceWhere,
  buildPeopleStaffSourceWhere,
  peoplePageSize,
  resolvePeopleListSort,
  type PeopleListSortDirection,
  type PeopleListSortKey,
  type PeopleListState,
} from '@/utilities/people/peopleListUrl'
import { municipalityIdsByStateDeputyIds } from '@/utilities/stateDeputyData'

/**
 * The unified people list (C100): three domain sources — leadership, dobradinha
 * and staff accounts — each read with the access of its own collection, then
 * merged in memory by `Contact` id so one physical person is ONE row whose
 * capacities fill columns.
 *
 * Access contract (impl plan D2/D3): the actor's scope is enforced by the
 * merge, never by widening a domain where. An advisor sees only rows with at
 * least one capacity municipality in his carteira; unrestricted actors see
 * every person with any role. The staff source reads with a justified
 * `overrideAccess` (the `contact` field is identity-gated and would be cut
 * from the depth-1 populate otherwise) — same precedent as
 * `loadAdvisorListPageData` and `canReadCampaignUserPhone`'s same-municipality
 * rule: the surface never exposes a row the merge scope did not authorize.
 */

type PeopleStaffCapacity = {
  id: number
  name: string
  role: CampaignUser['role']
  municipalityIDs: number[]
}

export type PeopleRowViewModel = {
  contactID: number
  name: string
  phone: string | null
  email: string | null
  city: string | null
  /** `stateDeputy.party` — the one party source (at most one dobradinha per ficha). */
  party: string | null
  /** C129 — `stateDeputy.ballotName`, the "nome de legenda" for the urna. */
  ballotName: string | null
  leadershipID: number | null
  leadershipMunicipalityIDs: number[]
  supportStatus: SupportStatus | null
  hasAppAccess: boolean
  deputyID: number | null
  deputyMunicipalityIDs: number[]
  staff: PeopleStaffCapacity[]
  /** Union of the staff accounts' carteiras — the Assessora column. */
  assessoraMunicipalityIDs: number[]
  /** Union of every capacity's municipalities — scope and the Município facet. */
  capacityMunicipalityIDs: number[]
  /** Union of leadership + dobradinha advisors, names resolved (Assessorado). */
  assessoradoNames: string[]
  /** Union of leadership + dobradinha advisors as id+name pairs (Assessorado chips, C116). */
  assessorados: Array<{ id: number; name: string }>
}

/**
 * C129 — the Name-cell subline of `/campanha/pessoas`: the dobradinha's
 * "nome de legenda" (ballot name), discreet under the real name, when present.
 *
 * C130 extends this with the base fallback — the FINAL shared rule for the
 * second line is `ballotName ?? city` (legenda overrides base), the two plans
 * (`pessoas-nome-de-legenda-dobradinha.md` / `pessoas-tabela-desktop-ajustes.md`)
 * pin it, and this function is the single seam: C130 changes one expression
 * here (and its unit spec), never markup. Until C130 lands, this branch keeps
 * the accept "sem nome de legenda, nada muda na linha" — null when absent.
 */
export const peopleNameSubline = (person: MergedPerson | PeopleRowViewModel): string | null =>
  person.ballotName

/** The merge intermediate carries every field the list/detail row needs. */
export type MergedPerson = Omit<PeopleRowViewModel, 'assessoradoNames'> & {
  leadershipAdvisorIDs: number[]
  deputyAdvisorIDs: number[]
}

export type PeopleLeadershipSource = {
  id: number
  contactID: number
  name: string
  phone: string | null
  email: string | null
  city: string | null
  municipalityIDs: number[]
  supportStatus: SupportStatus | null
  hasAppAccess: boolean
  advisorIDs: number[]
}

export type PeopleDeputySource = {
  id: number
  contactID: number
  name: string
  phone: string | null
  email: string | null
  city: string | null
  party: string | null
  ballotName: string | null
  municipalityIDs: number[]
  advisorIDs: number[]
}

export type PeopleStaffSource = {
  id: number
  contactID: number
  name: string
  phone: string | null
  email: string | null
  city: string | null
  role: CampaignUser['role']
  municipalityIDs: number[]
}

export type PeopleMergeSources = {
  leaderships: readonly PeopleLeadershipSource[]
  deputies: readonly PeopleDeputySource[]
  staff: readonly PeopleStaffSource[]
}

const sortedDistinct = (values: Iterable<number>): number[] =>
  [...new Set(values)].sort((left, right) => left - right)

/**
 * Doc → source mappers shared by the list and the person detail (C118): the
 * capacity definition must never diverge between the two surfaces, so the
 * transforms (and the role filter of the staff source) live here once.
 */
export const toPeopleLeadershipSource = (doc: Leadership): PeopleLeadershipSource => {
  const contact = contactSummary(doc.contact)
  return {
    id: doc.id,
    contactID: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    city: contact.city,
    municipalityIDs: uniqueRelationshipIds(doc.municipalities),
    supportStatus: isSupportStatus(doc.supportStatus) ? doc.supportStatus : null,
    hasAppAccess: relationshipId(doc.user) !== null,
    advisorIDs: uniqueRelationshipIds(doc.advisors),
  }
}

export const toPeopleDeputySource = (
  doc: StateDeputy,
  municipalityIdsByDeputy: ReadonlyMap<number, number[]>,
): PeopleDeputySource => {
  const contact = contactSummary(doc.contact)
  return {
    id: doc.id,
    contactID: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    city: contact.city,
    party: doc.party ?? null,
    ballotName: doc.ballotName ?? null,
    municipalityIDs: municipalityIdsByDeputy.get(doc.id) ?? [],
    advisorIDs: uniqueRelationshipIds(doc.advisors),
  }
}

export const toPeopleStaffSource = (
  doc: CampaignUser,
  municipalityIdsByStaff: ReadonlyMap<number, number[]>,
): PeopleStaffSource => {
  const contact = contactSummary(doc.contact)
  return {
    id: doc.id,
    contactID: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    city: contact.city,
    role: doc.role,
    municipalityIDs: municipalityIdsByStaff.get(doc.id) ?? [],
  }
}

/** Dedupe + pt-BR sort of the assessed-by advisors (the Assessorado capacity). */
export const resolveAssessorados = (
  advisorIDs: readonly number[],
  namesById: ReadonlyMap<number, string>,
): Array<{ id: number; name: string }> =>
  [...new Set(advisorIDs)]
    .map((id) => ({ id, name: namesById.get(id) }))
    .filter((pair): pair is { id: number; name: string } => pair.name !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

/** Merged person → list/detail row: same fields, no accidental drift. */
export const toPeopleRowViewModel = (
  person: MergedPerson,
  assessorados: ReadonlyArray<{ id: number; name: string }>,
): PeopleRowViewModel => ({
  contactID: person.contactID,
  name: person.name,
  phone: person.phone,
  email: person.email,
  city: person.city,
  party: person.party,
  ballotName: person.ballotName,
  leadershipID: person.leadershipID,
  leadershipMunicipalityIDs: person.leadershipMunicipalityIDs,
  supportStatus: person.supportStatus,
  hasAppAccess: person.hasAppAccess,
  deputyID: person.deputyID,
  deputyMunicipalityIDs: person.deputyMunicipalityIDs,
  staff: person.staff,
  assessoraMunicipalityIDs: person.assessoraMunicipalityIDs,
  capacityMunicipalityIDs: person.capacityMunicipalityIDs,
  assessoradoNames: assessorados.map((pair) => pair.name),
  assessorados: [...assessorados],
})

/**
 * One row per `contactID`. The ficha fields come from the first source that
 * carries them (leadership, then dobradinha, then staff — same ficha, so the
 * data cannot disagree); capacities accumulate across sources. Staff with an
 * EMPTY carteira still count as a capacity: being staff is the papel, the
 * carteira only fills the Assessora column (gate 2026-08-09).
 */
export const mergePeopleSources = (sources: PeopleMergeSources): MergedPerson[] => {
  const byContact = new Map<number, MergedPerson>()

  const personFor = (contactID: number): MergedPerson => {
    const existing = byContact.get(contactID)
    if (existing) return existing
    const person: MergedPerson = {
      contactID,
      name: 'Contato',
      phone: null,
      email: null,
      city: null,
      party: null,
      ballotName: null,
      leadershipID: null,
      leadershipMunicipalityIDs: [],
      supportStatus: null,
      hasAppAccess: false,
      leadershipAdvisorIDs: [],
      deputyID: null,
      deputyMunicipalityIDs: [],
      deputyAdvisorIDs: [],
      staff: [],
      assessoraMunicipalityIDs: [],
      capacityMunicipalityIDs: [],
      assessorados: [],
    }
    byContact.set(contactID, person)
    return person
  }

  for (const leadership of sources.leaderships) {
    const person = personFor(leadership.contactID)
    person.name = leadership.name
    person.phone = leadership.phone
    person.email = leadership.email
    person.city = leadership.city
    person.leadershipID = leadership.id
    person.leadershipMunicipalityIDs = [...leadership.municipalityIDs]
    person.supportStatus = leadership.supportStatus
    person.hasAppAccess = leadership.hasAppAccess
    person.leadershipAdvisorIDs = [...leadership.advisorIDs]
  }

  for (const deputy of sources.deputies) {
    const person = personFor(deputy.contactID)
    if (person.leadershipID === null) {
      person.name = deputy.name
      person.phone = deputy.phone
      person.email = deputy.email
      person.city = deputy.city
    }
    person.party = deputy.party
    person.ballotName = deputy.ballotName
    person.deputyID = deputy.id
    person.deputyMunicipalityIDs = [...deputy.municipalityIDs]
    person.deputyAdvisorIDs = [...deputy.advisorIDs]
  }

  for (const staff of sources.staff) {
    const person = personFor(staff.contactID)
    if (person.leadershipID === null && person.deputyID === null) {
      person.name = staff.name
      person.phone = staff.phone
      person.email = staff.email
      person.city = staff.city
    }
    person.staff.push({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      municipalityIDs: [...staff.municipalityIDs],
    })
  }

  for (const person of byContact.values()) {
    const assessora = sortedDistinct(person.staff.flatMap((account) => account.municipalityIDs))
    person.assessoraMunicipalityIDs = assessora
    person.capacityMunicipalityIDs = sortedDistinct([
      ...person.leadershipMunicipalityIDs,
      ...person.deputyMunicipalityIDs,
      ...assessora,
    ])
  }

  return [...byContact.values()]
}

/**
 * Advisor viewer scope: a row stays iff at least one capacity municipality is
 * in the actor's carteira. `null` = unrestricted (no filter). Staff with an
 * empty carteira have no capacity municipality and are therefore only visible
 * to unrestricted actors — the consistent consequence of the inclusion rule.
 */
export const scopePeopleRows = (
  rows: readonly MergedPerson[],
  accessibleMunicipalityIds: ReadonlySet<number> | null,
): MergedPerson[] => {
  if (accessibleMunicipalityIds === null) return [...rows]
  return rows.filter((row) =>
    row.capacityMunicipalityIDs.some((id) => accessibleMunicipalityIds.has(id)),
  )
}

/**
 * In-memory list filters (C100): capacities OR within the facet (same as every
 * other list facet), municipalities intersect any capacity, statuses only
 * match leadership rows. `q` already ran at the source level. C117 absence
 * facets are OR within the facet: a row matches when it satisfies ANY selected
 * absence ("Sem assessor" OR "Sem base" OR "Sem contato").
 */
export const filterPeopleRows = (
  rows: readonly MergedPerson[],
  state: PeopleListState,
): MergedPerson[] =>
  rows.filter((row) => {
    if (state.capacities?.length) {
      const wanted = new Set(state.capacities)
      const matches =
        (wanted.has('assessora') && row.assessoraMunicipalityIDs.length > 0) ||
        (wanted.has('lideranca') && row.leadershipID !== null) ||
        (wanted.has('dobradinha') && row.deputyID !== null)
      if (!matches) return false
    }
    if (state.municipalities?.length) {
      const selected = new Set(state.municipalities)
      if (!row.capacityMunicipalityIDs.some((id) => selected.has(id))) return false
    }
    if (state.statuses?.length) {
      if (row.supportStatus === null || !state.statuses.includes(row.supportStatus)) return false
    }
    if (state.ausencias?.length) {
      const wanted = new Set(state.ausencias)
      const hasAdvisor = row.leadershipAdvisorIDs.length > 0 || row.deputyAdvisorIDs.length > 0
      const semAssessor = !hasAdvisor
      const semBase = row.city === null
      const semContato = row.phone === null
      const matches =
        (wanted.has('sem_assessor') && semAssessor) ||
        (wanted.has('sem_base') && semBase) ||
        (wanted.has('sem_contato') && semContato) ||
        // C125 — "Qualquer ausência": the exact union of the three predicates,
        // one chip for "fichas incompletas" (same OR-within-facet semantics).
        (wanted.has('qualquer_ausencia') && (semAssessor || semBase || semContato))
      if (!matches) return false
    }
    return true
  })

const mergedPersonAdvisorCount = (person: MergedPerson): number =>
  new Set([...person.leadershipAdvisorIDs, ...person.deputyAdvisorIDs]).size

/**
 * C117 — global sort over the FILTERED set (never the page), applied before
 * pagination. Keys are exactly the visible-by-default columns; municipality
 * columns sort by their count ("quem tem mais rede?"), text columns by value.
 * Nulls ("Sem…") always land last (B15 precedent), ties break by name, then
 * contact id — the same order the list opened with. The advisor-count map is
 * precomputed once so the comparator never allocates per comparison.
 */
export const sortPeopleRows = (
  rows: readonly MergedPerson[],
  sort: PeopleListSortKey,
  dir: PeopleListSortDirection,
): MergedPerson[] => {
  const direction = dir === 'asc' ? 1 : -1
  const advisorCounts = new Map(
    rows.map((person) => [person.contactID, mergedPersonAdvisorCount(person)] as const),
  )
  const sortValue = (person: MergedPerson): string | number | null => {
    switch (sort) {
      case 'name':
        return person.name
      case 'contact':
        return person.phone
      case 'base':
        return person.city
      case 'assessora':
        return person.assessoraMunicipalityIDs.length || null
      case 'lidera':
        return person.leadershipMunicipalityIDs.length || null
      case 'aliada':
        return person.deputyMunicipalityIDs.length || null
      case 'assessorado':
        return advisorCounts.get(person.contactID) || null
    }
  }
  const byNameThenId = (left: MergedPerson, right: MergedPerson): number =>
    left.name.localeCompare(right.name, 'pt-BR') || left.contactID - right.contactID
  const byValue = (left: string | number, right: string | number): number =>
    typeof left === 'string'
      ? left.localeCompare(right as string, 'pt-BR')
      : left - (right as number)

  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left)
    const rightValue = sortValue(right)
    if (leftValue === null && rightValue === null) return byNameThenId(left, right)
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    return byValue(leftValue, rightValue) * direction || byNameThenId(left, right)
  })
}

export type PeopleListFilterFacets = {
  /** Municipality ids present across the scoped rows (selected values unioned in). */
  municipalityIDs: number[]
  /** Leadership statuses present across the scoped rows (selected values unioned in). */
  statuses: SupportStatus[]
}

export const peopleFilterFacetsFromRows = (
  rows: readonly MergedPerson[],
  state: PeopleListState,
): PeopleListFilterFacets => {
  const municipalities = new Set<number>(state.municipalities ?? [])
  const statuses = new Set<SupportStatus>(state.statuses ?? [])
  for (const row of rows) {
    for (const id of row.capacityMunicipalityIDs) municipalities.add(id)
    if (row.supportStatus !== null) statuses.add(row.supportStatus)
  }
  return {
    municipalityIDs: [...municipalities].sort((left, right) => left - right),
    statuses: leadershipStatusesInOrder(statuses),
  }
}

const leadershipStatusesInOrder = (statuses: ReadonlySet<SupportStatus>): SupportStatus[] =>
  leadershipSupportStatuses.filter((status) => statuses.has(status))

const EMPTY_FACETS: PeopleListFilterFacets = { municipalityIDs: [], statuses: [] }

type ContactSummary = {
  id: number
  name: string
  phone: string | null
  email: string | null
  city: string | null
}

const contactSummary = (contact: Contact | number | null | undefined): ContactSummary => {
  if (contact !== null && typeof contact === 'object') {
    return {
      id: contact.id,
      name: contact.name ?? 'Contato',
      phone: primaryPhoneOf(contact.phones),
      email: contact.email ?? null,
      city: contact.city ?? null,
    }
  }
  return { id: Number(contact), name: 'Contato', phone: null, email: null, city: null }
}

/**
 * The page data for `/campanha/pessoas`. `q` runs at the source level; the
 * capacity/municipality/status filters, the advisor scope and the facets run
 * over the merged rows. Advisor names for the Assessorado column are resolved
 * for the visible page only.
 */
export const loadPeopleListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: PeopleListState,
): Promise<{
  rows: PeopleRowViewModel[]
  totalDocs: number
  totalPages: number
  filterFacets: PeopleListFilterFacets
}> => {
  if (!isCampaignStaff(user)) {
    return { rows: [], totalDocs: 0, totalPages: 0, filterFacets: EMPTY_FACETS }
  }

  const [leadershipResult, deputyResult, staffResult] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: buildPeopleLeadershipSourceWhere(state),
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
      where: buildPeopleDeputySourceWhere(state),
      depth: 1,
      limit: 0,
      pagination: false,
      select: { contact: true, slug: true, party: true, ballotName: true, advisors: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'campaignUser',
      where: buildPeopleStaffSourceWhere(state),
      depth: 1,
      limit: 0,
      pagination: false,
      select: { name: true, role: true, contact: true },
      // Intentional admin bypass (impl plan D2): the `contact` field is
      // identity-gated (`canReadCampaignUserIdentity`) and the actor scope is
      // enforced by the merge below — same rationale as `loadAdvisorListPageData`.
      overrideAccess: true,
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

  const leaderships: PeopleLeadershipSource[] = (leadershipResult.docs as Leadership[]).map(
    toPeopleLeadershipSource,
  )

  const deputies: PeopleDeputySource[] = (deputyResult.docs as StateDeputy[]).map((doc) =>
    toPeopleDeputySource(doc, deputyMunicipalityIdsByDeputy),
  )

  const staff: PeopleStaffSource[] = (staffResult.docs as CampaignUser[]).map((doc) =>
    toPeopleStaffSource(doc, staffMunicipalityIdsByStaff),
  )

  const merged = mergePeopleSources({ leaderships, deputies, staff })
  const accessibleMunicipalityIds =
    user.role === 'advisor' ? new Set(await getAdvisorMunicipalityIds(payload, user.id)) : null
  const scoped = scopePeopleRows(merged, accessibleMunicipalityIds)
  const filterFacets = peopleFilterFacetsFromRows(scoped, state)
  const filtered = filterPeopleRows(scoped, state)
  const { sort: sortKey, dir: sortDir } = resolvePeopleListSort(state)
  const sorted = sortPeopleRows(filtered, sortKey, sortDir)

  const totalDocs = sorted.length
  const totalPages = Math.ceil(totalDocs / peoplePageSize)
  const pageRows = sorted.slice((state.page - 1) * peoplePageSize, state.page * peoplePageSize)

  const advisorIDs = new Set<number>()
  for (const row of pageRows) {
    for (const id of row.leadershipAdvisorIDs) advisorIDs.add(id)
    for (const id of row.deputyAdvisorIDs) advisorIDs.add(id)
  }
  const advisorNames = await loadCampaignUserNamesByIds(payload, [...advisorIDs])

  const rows: PeopleRowViewModel[] = pageRows.map((person) =>
    toPeopleRowViewModel(
      person,
      resolveAssessorados(
        [...person.leadershipAdvisorIDs, ...person.deputyAdvisorIDs],
        advisorNames,
      ),
    ),
  )

  return { rows, totalDocs, totalPages, filterFacets }
}
