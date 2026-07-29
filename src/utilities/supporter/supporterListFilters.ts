import type { Where } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { normalizeBrazilianPhone } from '@/lib/phone'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'

/**
 * The filters the where-builder actually reads — a structural subset of
 * `SupporterListState` (`supporterUi.ts`), declared here so the type flows
 * url-module → where-builder without a module cycle.
 */
export type SupporterListFilterInput = {
  q?: string
  voteIntention?: SupporterVoteIntention
  city?: string
  municipality?: number
}

export type SupporterSearchTerms = {
  q: string
  normalizedPhone: string | null
  phoneDigits: string | null
}

export const buildSupporterSearchTerms = (rawQ: string): SupporterSearchTerms | null => {
  if (!isContactSearchQueryReady(rawQ)) return null

  const { trimmed, digits } = normalizeContactSearchQuery(rawQ)
  const normalizedPhone = normalizeBrazilianPhone(trimmed)
  const phoneDigits = !normalizedPhone && digits ? digits : null

  return { q: trimmed, normalizedPhone, phoneDigits }
}

const buildPayloadSearchWhere = (terms: SupporterSearchTerms): Where => {
  const searchFilters: Where[] = [
    { 'contact.name': { contains: terms.q } },
    { 'contact.city': { contains: terms.q } },
  ]

  if (terms.normalizedPhone) {
    searchFilters.push({ 'contact.phone': { equals: terms.normalizedPhone } })
  } else if (terms.phoneDigits) {
    searchFilters.push({ 'contact.phone': { contains: terms.phoneDigits } })
  }

  return { or: searchFilters }
}

export const toPayloadWhere = (state: SupporterListFilterInput): Where => {
  const filters: Where[] = []

  if (state.q) {
    const searchTerms = buildSupporterSearchTerms(state.q)
    if (searchTerms) {
      filters.push(buildPayloadSearchWhere(searchTerms))
    }
  }

  if (state.voteIntention) {
    filters.push({ voteIntention: { equals: state.voteIntention } })
  }
  if (state.city) {
    filters.push({ 'contact.city': { equals: state.city } })
  }
  if (state.municipality) {
    filters.push({ municipality: { equals: state.municipality } })
  }

  return filters.length ? { and: filters } : {}
}
