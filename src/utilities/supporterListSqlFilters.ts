import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import {
  buildSupporterSearchTerms,
  type SupporterSearchTerms,
} from '@/utilities/supporterListFilters'
import type { SupporterListState } from '@/utilities/supporterUi'

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
    searchTerms.push(sql`"contact"."phone" = ${terms.normalizedPhone}`)
  } else if (terms.phoneDigits) {
    searchTerms.push(sql`"contact"."phone" ILIKE ${`%${terms.phoneDigits}%`}`)
  }

  return sql`(${sql.join(searchTerms, sql` OR `)})`
}

export const toAggregateSqlConditions = (state: SupporterListState): AggregateSqlConditions => {
  const conditions: ReturnType<typeof sql>[] = []
  let needsContactJoin = false

  if (state.voteIntention) {
    conditions.push(sql`"supporter"."vote_intention" = ${state.voteIntention}`)
  }

  if (state.plaza) {
    conditions.push(sql`"supporter"."plaza_id" = ${state.plaza}`)
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
