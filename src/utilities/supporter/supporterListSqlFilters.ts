import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import type { SupporterListFilterInput } from '@/utilities/supporter/supporterListFilters'
import {
  buildSupporterSearchTerms,
  type SupporterSearchTerms,
} from '@/utilities/supporter/supporterListFilters'

export type AggregateSqlConditions = {
  conditions: ReturnType<typeof sql>[]
  needsContactJoin: boolean
}

const buildSqlSearchCondition = (terms: SupporterSearchTerms): ReturnType<typeof sql> => {
  const searchTerms: ReturnType<typeof sql>[] = [
    sql`"contact"."name" ILIKE ${`%${terms.q}%`}`,
    sql`"contact"."city" ILIKE ${`%${terms.q}%`}`,
  ]

  if (terms.normalizedPhone) {
    // Matches ANY of the ficha's numbers (C112) — EXISTS over the join table.
    searchTerms.push(
      sql`EXISTS (SELECT 1 FROM "contact_phones" WHERE "contact_phones"."_parent_id" = "contact"."id" AND "contact_phones"."value" = ${terms.normalizedPhone})`,
    )
  } else if (terms.phoneDigits) {
    searchTerms.push(
      sql`EXISTS (SELECT 1 FROM "contact_phones" WHERE "contact_phones"."_parent_id" = "contact"."id" AND "contact_phones"."value" ILIKE ${`%${terms.phoneDigits}%`})`,
    )
  }

  return sql`(${sql.join(searchTerms, sql` OR `)})`
}

export const toAggregateSqlConditions = (
  state: SupporterListFilterInput,
): AggregateSqlConditions => {
  const conditions: ReturnType<typeof sql>[] = []
  let needsContactJoin = false

  if (state.voteIntention) {
    conditions.push(sql`"supporter"."vote_intention" = ${state.voteIntention}`)
  }

  if (state.source) {
    conditions.push(sql`"supporter"."source" = ${state.source}`)
  }

  if (state.municipality) {
    conditions.push(sql`"supporter"."municipality_id" = ${state.municipality}`)
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
