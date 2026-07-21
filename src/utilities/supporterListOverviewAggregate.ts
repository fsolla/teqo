import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { getAdvisorPlazaIds, isCampaignCoordinator } from '@/utilities/campaignAccess'
import { drizzleResultRows } from '@/utilities/drizzleBulk'
import { toAggregateSqlConditions } from '@/utilities/supporterListSqlFilters'
import type { SupporterListState } from '@/utilities/supporterUi'
import type { SupporterListOverviewViewModel } from '@/utilities/supporterViewModels'

type AccessConstraint =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'plazaSet'; ids: number[] }

type PostgresDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

const resolveAccessConstraint = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  advisorPlazaIds?: number[],
): Promise<AccessConstraint> => {
  if (isCampaignCoordinator(user)) return { kind: 'all' }
  if (user.role !== 'advisor') return { kind: 'none' }

  const ids = advisorPlazaIds ?? (await getAdvisorPlazaIds(payload, user.id))
  return { kind: 'plazaSet', ids }
}

const buildAggregateSql = (
  state: SupporterListState,
  access: AccessConstraint,
): ReturnType<typeof sql> => {
  const { conditions: filterConditions, needsContactJoin } = toAggregateSqlConditions(state)
  const conditions = [...filterConditions]

  if (access.kind === 'plazaSet') {
    if (access.ids.length === 0) {
      // No accessible plazas → no rows. Keep a trivially-false condition.
      conditions.push(sql`FALSE`)
    } else {
      conditions.push(
        sql`"supporter"."plaza_id" IN (${sql.join(
          access.ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
    }
  }

  const whereClause =
    conditions.length > 0 ? sql` WHERE ${sql.join(conditions, sql` AND `)}` : sql``

  const fromClause = needsContactJoin
    ? sql`FROM "supporter" LEFT JOIN "contact" ON "contact"."id" = "supporter"."contact_id"`
    : sql`FROM "supporter"`

  // `total` is NOT selected here — the caller already computed it from the
  // list query's `totalDocs` (same filters, same access scope), so the
  // aggregate only needs to run the two FILTER counts.
  return sql`
    SELECT
      COUNT(*) FILTER (WHERE "supporter"."vote_intention" IN ('certo', 'tende_a_certo')) AS "certo_and_tende",
      COUNT(*) FILTER (WHERE "supporter"."vote_intention" = 'indeciso') AS "indeciso"
    ${fromClause}${whereClause}
  `
}

/**
 * Computes the supporter overview KPIs (vote-intention breakdown) for the
 * caller's already-resolved list `total` (from `result.totalDocs`, computed
 * with the same filters and access scope). Skips the aggregate query entirely
 * when `total` is 0, since the panel is hidden in that case anyway.
 */
export const computeSupporterListOverviewAggregate = async (
  payload: Payload,
  user: CampaignUser,
  state: SupporterListState,
  total: number,
  advisorPlazaIds?: number[],
): Promise<SupporterListOverviewViewModel | null> => {
  if (!Number.isSafeInteger(total) || total <= 0) return null

  const access = await resolveAccessConstraint(payload, user, advisorPlazaIds)
  if (access.kind === 'none') return null
  if (access.kind === 'plazaSet' && access.ids.length === 0) return null

  if (payload.db.name !== 'postgres') {
    throw new Error('O overview de apoiadores exige o adaptador PostgreSQL.')
  }
  const database = payload.db as unknown as { drizzle?: PostgresDb }
  const drizzle = database.drizzle
  if (!drizzle || typeof drizzle.execute !== 'function') {
    throw new Error('A sessão PostgreSQL do overview de apoiadores não está disponível.')
  }

  const result = await drizzle.execute(buildAggregateSql(state, access))
  const row = drizzleResultRows(result)[0]
  if (!row) return null

  return {
    total,
    certoAndTende: Number(row.certo_and_tende ?? 0),
    indeciso: Number(row.indeciso ?? 0),
  }
}
