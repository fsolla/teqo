import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import { leadershipGenders } from '@/lib/schemas/leadership'
import type { CampaignUser, Contact, Leadership, StateDeputy } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import {
  buildContactListWhere,
  contactPageSize,
  resolveContactListSort,
  type ContactGender,
  type ContactListState,
  type ContactStateKey,
  type ContactVinculo,
} from '@/utilities/contacts/contactListUrl'

/**
 * The contacts page data (C139): ONE source — the `Contact` ficha itself.
 * Unlike people, there is no merge: the list IS the ficha, and the actor
 * scope is enforced by the `contact` collection's own `canReadContacts`
 * access (read with `user` threaded + `overrideAccess: false`).
 *
 * Vínculos (liderança, dobradinha, assessores, equipe) enter ONLY as facets:
 * three small queries resolve which readable contacts carry which link, so
 * the omnibox can filter "fichas com liderança" etc. The staff source
 * (`campaignUser`) reads with a justified `overrideAccess` — staff identity
 * is gated by a different collection rule — and the merge never widens the
 * surface: a contact id outside the readable set is simply not a row here.
 */

type ContactVinculosByID = ReadonlyMap<number, ContactVinculo[]>

export type ContactRowViewModel = {
  contactID: number
  name: string
  email: string | null
  /** Stored order = priority (first is primary) — C112 contract. */
  phones: string[]
  gender: ContactGender | null
  state: ContactStateKey | null
  city: string | null
  postalCode: string | null
  /** Which vínculos this ficha carries (facet + filter, never a column). */
  vinculos: ContactVinculo[]
}

export type ContactListFilterFacets = {
  genders: ContactGender[]
  states: ContactStateKey[]
  cities: string[]
  vinculos: ContactVinculo[]
}

const EMPTY_FACETS: ContactListFilterFacets = { genders: [], states: [], cities: [], vinculos: [] }

const isContactGender = (value: unknown): value is ContactGender =>
  typeof value === 'string' && leadershipGenders.some((gender) => gender === value)

const isStateKey = (value: unknown): value is ContactStateKey =>
  typeof value === 'string' && /^[A-Z]{2}$/.test(value)

export const toContactRowViewModel = (doc: Contact): ContactRowViewModel => ({
  contactID: doc.id,
  name: doc.name,
  email: doc.email ?? null,
  phones: Array.isArray(doc.phones)
    ? doc.phones.map((entry) => entry.value).filter((value): value is string => !!value)
    : [],
  gender: isContactGender(doc.gender) ? doc.gender : null,
  state: isStateKey(doc.state) ? doc.state : null,
  city: doc.city ?? null,
  postalCode: doc.postalCode ?? null,
  vinculos: [],
})

/**
 * Resolves the vínculo map for the scoped contact set. Each source reads with
 * its own collection access (`user` threaded); the campaignUser source needs
 * the justified admin bypass (staff identity lives behind
 * `canReadCampaignUserIdentity`, same precedent as the people staff source) —
 * the result is intersected with the readable contact ids, so a link never
 * widens the list.
 */
const loadContactVinculos = async (
  payload: Payload,
  user: CampaignUser,
  readableContactIDs: ReadonlySet<number>,
): Promise<ContactVinculosByID> => {
  const byID = new Map<number, Set<ContactVinculo>>()
  const add = (contactID: number, vinculo: ContactVinculo) => {
    if (!readableContactIDs.has(contactID)) return
    let set = byID.get(contactID)
    if (!set) {
      set = new Set()
      byID.set(contactID, set)
    }
    set.add(vinculo)
  }

  const [leadershipResult, deputyResult, staffResult] = await Promise.all([
    payload.find({
      collection: 'leadership',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { contact: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'stateDeputy',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { contact: true },
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'campaignUser',
      depth: 0,
      limit: 0,
      pagination: false,
      select: { contact: true },
      // Intentional bypass (impl plan D): the `contact` field is
      // identity-gated and the actor scope is enforced by the readable-set
      // intersection below — same rationale as the people staff source.
      overrideAccess: true,
    }),
  ])

  for (const doc of leadershipResult.docs as Leadership[]) {
    const id = relationshipId(doc.contact)
    if (id !== null) add(id, 'liderancas')
  }
  for (const doc of deputyResult.docs as StateDeputy[]) {
    const id = relationshipId(doc.contact)
    if (id !== null) add(id, 'dobradinhas')
  }
  for (const doc of staffResult.docs as CampaignUser[]) {
    const id = relationshipId(doc.contact)
    if (id !== null) add(id, 'equipe')
  }

  const result = new Map<number, ContactVinculo[]>()
  for (const [id, set] of byID) {
    result.set(
      id,
      [...set].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    )
  }
  return result
}

const vinculoSet = (row: ContactRowViewModel): Set<ContactVinculo> => new Set(row.vinculos)

export const filterContactRows = (
  rows: readonly ContactRowViewModel[],
  state: ContactListState,
): ContactRowViewModel[] =>
  rows.filter((row) => {
    if (state.genders?.length) {
      if (row.gender === null || !state.genders.includes(row.gender)) return false
    }
    if (state.states?.length) {
      if (row.state === null || !state.states.includes(row.state)) return false
    }
    if (state.cities?.length) {
      const wanted = new Set(state.cities.map((city) => city.toLowerCase()))
      if (row.city === null || !wanted.has(row.city.toLowerCase())) return false
    }
    if (state.ausencias?.length) {
      const wanted = new Set(state.ausencias)
      const semTelefone = row.phones.length === 0
      const semEmail = row.email === null
      const matches =
        (wanted.has('sem_telefone') && semTelefone) || (wanted.has('sem_email') && semEmail)
      if (!matches) return false
    }
    if (state.vinculos?.length) {
      const links = vinculoSet(row)
      if (!state.vinculos.some((vinculo) => links.has(vinculo))) return false
    }
    return true
  })

export const contactFilterFacetsFromRows = (
  rows: readonly ContactRowViewModel[],
  state: ContactListState,
): ContactListFilterFacets => {
  const genders = new Set<ContactGender>(state.genders ?? [])
  const states = new Set<ContactStateKey>(state.states ?? [])
  // City is free text: dedupe case-insensitively but keep the first-seen
  // casing for display (data-driven facet, municipality precedent).
  const cities = new Map<string, string>()
  for (const city of state.cities ?? []) {
    cities.set(city.toLowerCase(), city)
  }
  const vinculos = new Set<ContactVinculo>(state.vinculos ?? [])
  for (const row of rows) {
    if (row.gender !== null) genders.add(row.gender)
    if (row.state !== null) states.add(row.state)
    if (row.city !== null && !cities.has(row.city.toLowerCase())) {
      cities.set(row.city.toLowerCase(), row.city)
    }
    for (const vinculo of row.vinculos) vinculos.add(vinculo)
  }
  return {
    genders: [...genders].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    states: [...states].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    cities: [...cities.values()].sort((left, right) => left.localeCompare(right, 'pt-BR')),
    vinculos: [...vinculos].sort((left, right) => left.localeCompare(right, 'pt-BR')),
  }
}

/**
 * C139 — global sort over the FILTERED set (never the page), applied before
 * pagination. Text columns by value; nulls ("Sem…") always land last (B15
 * precedent), ties break by name, then contact id — the same order the list
 * opened with.
 */
export const sortContactRows = (
  rows: readonly ContactRowViewModel[],
  sort: ContactListState['sort'],
  dir: ContactListState['dir'],
): ContactRowViewModel[] => {
  const direction = dir === 'asc' ? 1 : -1
  const sortValue = (row: ContactRowViewModel): string | null => {
    switch (sort) {
      case 'cidade':
        return row.city
      case 'estado':
        return row.state
      case 'email':
        return row.email
      case 'name':
      default:
        return row.name
    }
  }
  const byNameThenId = (left: ContactRowViewModel, right: ContactRowViewModel): number =>
    left.name.localeCompare(right.name, 'pt-BR') || left.contactID - right.contactID

  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left)
    const rightValue = sortValue(right)
    if (leftValue === null && rightValue === null) return byNameThenId(left, right)
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    return leftValue.localeCompare(rightValue, 'pt-BR') * direction || byNameThenId(left, right)
  })
}

/**
 * The page data for `/campanha/contatos`. `q` runs at the source level; the
 * property/vínculo filters, the facets and the pagination run in memory over
 * the scoped rows (one source — no merge cost).
 */
export const loadContactListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: ContactListState,
): Promise<{
  rows: ContactRowViewModel[]
  totalDocs: number
  totalPages: number
  filterFacets: ContactListFilterFacets
}> => {
  if (!isCampaignStaff(user)) {
    return { rows: [], totalDocs: 0, totalPages: 0, filterFacets: EMPTY_FACETS }
  }

  const contactResult = await payload.find({
    collection: 'contact',
    where: buildContactListWhere(state),
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      name: true,
      email: true,
      phones: true,
      gender: true,
      state: true,
      city: true,
      postalCode: true,
    },
    user,
    overrideAccess: false,
  })

  const docs = contactResult.docs as Contact[]
  const rows = docs.map(toContactRowViewModel)
  const readableContactIDs = new Set(rows.map((row) => row.contactID))
  const vinculosByID = await loadContactVinculos(payload, user, readableContactIDs)
  for (const row of rows) {
    row.vinculos = vinculosByID.get(row.contactID) ?? []
  }

  const filterFacets = contactFilterFacetsFromRows(rows, state)
  const filtered = filterContactRows(rows, state)
  const { sort, dir } = resolveContactListSort(state)
  const sorted = sortContactRows(filtered, sort, dir)

  const totalDocs = sorted.length
  const totalPages = Math.ceil(totalDocs / contactPageSize)
  const pageRows = sorted.slice((state.page - 1) * contactPageSize, state.page * contactPageSize)

  return { rows: pageRows, totalDocs, totalPages, filterFacets }
}
