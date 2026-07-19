import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { getCoordinatorNucleusIds, isCampaignGeneral } from '@/utilities/campaignAccess'
import { drizzleResultRows } from '@/utilities/drizzleBulk'
import { normalizeBrazilianPhone } from '@/utilities/phone'
import type { SupporterListState } from '@/utilities/supporterUi'
import type { SupporterListOverviewViewModel } from '@/utilities/supporterViewModels'

type AccessConstraint =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'nucleusSet'; ids: number[] }

type PostgresDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

const resolveAccessConstraint = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  coordinatorNucleusIds?: number[],
): Promise<AccessConstraint> => {
  if (isCampaignGeneral(user)) return { kind: 'all' }
  if (user.role !== 'coordenador') return { kind: 'none' }

  const ids =
    coordinatorNucleusIds ?? (await getCoordinatorNucleusIds(payload, user.id))
  return { kind: 'nucleusSet', ids }
}

const buildAggregateSql = (
  state: SupporterListState,
  access: AccessConstraint,
): ReturnType<typeof sql> => {
  const conditions: ReturnType<typeof sql>[] = []
  const needsContactJoin = Boolean(state.q || state.city)

  if (access.kind === 'nucleusSet') {
    if (access.ids.length === 0) {
      // No accessible nuclei → no rows. Keep a trivially-false condition.
      conditions.push(sql`FALSE`)
    } else {
      conditions.push(
        sql`"supporter"."nucleus_id" IN (${sql.join(
          access.ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
    }
  }

  if (state.voteIntention) {
    conditions.push(sql`"supporter"."vote_intention" = ${state.voteIntention}`)
  }

  if (state.nucleus) {
    conditions.push(sql`"supporter"."nucleus_id" = ${state.nucleus}`)
  }

  if (state.city) {
    conditions.push(sql`"contact"."city" = ${state.city}`)
  }

  if (state.q) {
    const searchTerms: ReturnType<typeof sql>[] = [
      sql`"contact"."name" ILIKE ${`%${state.q}%`}`,
      sql`"contact"."city" ILIKE ${`%${state.q}%`}`,
    ]
    const normalizedPhone = normalizeBrazilianPhone(state.q)
    if (normalizedPhone) {
      searchTerms.push(sql`"contact"."phone" = ${normalizedPhone}`)
    } else if (/\d/.test(state.q)) {
      const digits = state.q.replace(/\D/g, '')
      if (digits) searchTerms.push(sql`"contact"."phone" ILIKE ${`%${digits}%`}`)
    }
    conditions.push(sql`(${sql.join(searchTerms, sql` OR `)})`)
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
  coordinatorNucleusIds?: number[],
): Promise<SupporterListOverviewViewModel | null> => {
  if (!Number.isSafeInteger(total) || total <= 0) return null

  const access = await resolveAccessConstraint(payload, user, coordinatorNucleusIds)
  if (access.kind === 'none') return null
  if (access.kind === 'nucleusSet' && access.ids.length === 0) return null

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
