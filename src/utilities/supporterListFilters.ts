import { sql } from '@payloadcms/db-postgres'
import type { Where } from 'payload'

import { isContactSearchQueryReady, normalizeContactSearchQuery } from '@/lib/contactSearchQuery'
import { normalizeBrazilianPhone } from '@/utilities/phone'
import type { SupporterListState } from '@/utilities/supporterUi'

export type SupporterSearchTerms = {
  q: string
  normalizedPhone: string | null
  phoneDigits: string | null
}

export type AggregateSqlConditions = {
  conditions: ReturnType<typeof sql>[]
  needsContactJoin: boolean
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

const buildSqlSearchCondition = (terms: SupporterSearchTerms): ReturnType<typeof sql> => {
  const searchTerms: ReturnType<typeof sql>[] = [
    sql`"contact"."name" ILIKE ${`%${terms.q}%`}`,
    sql`"contact"."city" ILIKE ${`%${terms.q}%`}`,
  ]

  if (terms.normalizedPhone) {
    searchTerms.push(sql`"contact"."phone" = ${terms.normalizedPhone}`)
  } else if (terms.phoneDigits) {
    searchTerms.push(sql`"contact"."phone" ILIKE ${`%${terms.phoneDigits}%`}`)
  }

  return sql`(${sql.join(searchTerms, sql` OR `)})`
}

export const toPayloadWhere = (state: SupporterListState): Where => {
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
  if (state.nucleus) {
    filters.push({ nucleus: { equals: state.nucleus } })
  }

  return filters.length ? { and: filters } : {}
}

export const toAggregateSqlConditions = (state: SupporterListState): AggregateSqlConditions => {
  const conditions: ReturnType<typeof sql>[] = []
  let needsContactJoin = false

  if (state.voteIntention) {
    conditions.push(sql`"supporter"."vote_intention" = ${state.voteIntention}`)
  }

  if (state.nucleus) {
    conditions.push(sql`"supporter"."nucleus_id" = ${state.nucleus}`)
  }

  if (state.city) {
    needsContactJoin = true
    conditions.push(sql`"contact"."city" = ${state.city}`)
  }

  if (state.q) {
    const searchTerms = buildSupporterSearchTerms(state.q)
    if (searchTerms) {
      needsContactJoin = true
      conditions.push(buildSqlSearchCondition(searchTerms))
    }
  }

  return { conditions, needsContactJoin }
}
