import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { isCampaignGeneral } from '@/utilities/campaignAccess'
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

const resultRows = (result: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}

const resolveAccessConstraint = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
): Promise<AccessConstraint> => {
  if (isCampaignGeneral(user)) return { kind: 'all' }
  if (user.role !== 'coordenador') return { kind: 'none' }

  const result = await payload.find({
    collection: 'electoralNucleus',
    where: { coordinators: { contains: user.id } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  const ids = result.docs.map((doc) => doc.id)

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

  return sql`
    SELECT
      COUNT(*) AS "total",
      COUNT(*) FILTER (WHERE "supporter"."vote_intention" IN ('certo', 'tende_a_certo')) AS "certo_and_tende",
      COUNT(*) FILTER (WHERE "supporter"."vote_intention" = 'indeciso') AS "indeciso"
    ${fromClause}${whereClause}
  `
}

export const computeSupporterListOverviewAggregate = async (
  payload: Payload,
  user: CampaignUser,
  state: SupporterListState,
): Promise<SupporterListOverviewViewModel | null> => {
  const access = await resolveAccessConstraint(payload, user)
  if (access.kind === 'none') return null

  if (payload.db.name !== 'postgres') {
    throw new Error('O overview de apoiadores exige o adaptador PostgreSQL.')
  }
  const database = payload.db as unknown as { drizzle?: PostgresDb }
  const drizzle = database.drizzle
  if (!drizzle || typeof drizzle.execute !== 'function') {
    throw new Error('A sessão PostgreSQL do overview de apoiadores não está disponível.')
  }

  const result = await drizzle.execute(buildAggregateSql(state, access))
  const row = resultRows(result)[0]
  if (!row) return null

  const total = Number(row.total)
  if (!Number.isSafeInteger(total) || total === 0) return null

  return {
    total,
    certoAndTende: Number(row.certo_and_tende ?? 0),
    indeciso: Number(row.indeciso ?? 0),
  }
}
