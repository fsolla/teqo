import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { drizzleResultRows } from '@/utilities/drizzleBulk'
import {
  getPostgresTransactionDatabase,
  type PostgresTransactionDatabase,
} from '@/utilities/postgresTransactionLocks'

/**
 * C155 backfill coverage: what the catalog actually HAS, per legislature.
 * The run report says what one execution did; this says what is stored, so a
 * resumed/partial run cannot be mistaken for the final state. Read-only, one
 * aggregate query (`--coverage` in the import CLI).
 */

export type SpeechLegislatureCoverage = {
  legislature: string | null
  total: number
  withExcerpt: number
  withVideo: number
  withSegments: number
  withoutExcerpt: number
  withoutSegments: number
  fallbackYoutube: number
}

export type SpeechCoverage = {
  byLegislature: SpeechLegislatureCoverage[]
  totals: Omit<SpeechLegislatureCoverage, 'legislature'>
}

type CoverageRequest = { transactionID?: PayloadRequest['transactionID'] }

const COVERAGE_QUERY = sql`
  SELECT
    s."legislature" AS "legislature",
    COUNT(*) AS "total",
    COUNT(*) FILTER (WHERE s."audio_id" IS NOT NULL) AS "with_excerpt",
    COUNT(*) FILTER (WHERE s."vod_playback_url" IS NOT NULL) AS "with_video",
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM "speech_segment" seg WHERE seg."speech_id" = s."id"
    )) AS "with_segments",
    COUNT(*) FILTER (WHERE s."audio_id" IS NULL AND s."youtube_url" IS NOT NULL) AS "fallback_youtube"
  FROM "speech" s
  WHERE s."origin" = 'camara'
  GROUP BY s."legislature"
  ORDER BY s."legislature" NULLS LAST
`

const toCount = (value: unknown): number => {
  const count = Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

const rowToCoverage = (row: Record<string, unknown>): SpeechLegislatureCoverage => {
  const total = toCount(row.total)
  const withExcerpt = toCount(row.with_excerpt)
  const withSegments = toCount(row.with_segments)
  return {
    legislature:
      row.legislature === null || row.legislature === undefined ? null : String(row.legislature),
    total,
    withExcerpt,
    withVideo: toCount(row.with_video),
    withSegments,
    withoutExcerpt: total - withExcerpt,
    withoutSegments: total - withSegments,
    fallbackYoutube: toCount(row.fallback_youtube),
  }
}

const sumCoverage = (
  rows: SpeechLegislatureCoverage[],
): Omit<SpeechLegislatureCoverage, 'legislature'> =>
  rows.reduce(
    (totals, row) => ({
      total: totals.total + row.total,
      withExcerpt: totals.withExcerpt + row.withExcerpt,
      withVideo: totals.withVideo + row.withVideo,
      withSegments: totals.withSegments + row.withSegments,
      withoutExcerpt: totals.withoutExcerpt + row.withoutExcerpt,
      withoutSegments: totals.withoutSegments + row.withoutSegments,
      fallbackYoutube: totals.fallbackYoutube + row.fallbackYoutube,
    }),
    {
      total: 0,
      withExcerpt: 0,
      withVideo: 0,
      withSegments: 0,
      withoutExcerpt: 0,
      withoutSegments: 0,
      fallbackYoutube: 0,
    },
  )

/**
 * Per-legislature coverage of the speech catalog. Pass a `req` with an active
 * transaction (int tests) to run the aggregate on that transaction's session;
 * the CLI calls it without one and reads the pooled connection.
 */
export const getSpeechCoverage = async (
  payload: Payload,
  req?: CoverageRequest,
): Promise<SpeechCoverage> => {
  if (payload.db.name !== 'postgres') {
    throw new Error('A cobertura do acervo exige o adaptador PostgreSQL.')
  }

  let database: PostgresTransactionDatabase | undefined
  if (req?.transactionID) {
    database = await getPostgresTransactionDatabase(payload, req)
  } else {
    database = (payload.db as unknown as { drizzle?: PostgresTransactionDatabase }).drizzle
  }
  if (!database || typeof database.execute !== 'function') {
    throw new Error('A sessão PostgreSQL da cobertura do acervo não está disponível.')
  }

  const rows = drizzleResultRows(await database.execute(COVERAGE_QUERY)).map(rowToCoverage)
  return { byLegislature: rows, totals: sumCoverage(rows) }
}
