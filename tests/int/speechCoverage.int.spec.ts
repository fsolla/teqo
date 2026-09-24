// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import { randomUUID } from 'node:crypto'
import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { getPostgresTransactionDatabase } from '@/utilities/postgresTransactionLocks'
import {
  getSpeechCoverage,
  type SpeechCoverage,
  type SpeechLegislatureCoverage,
} from '@/utilities/speech/speechCoverage'

let payload: Payload

type SpeechCreateData = RequiredDataFromCollectionSlug<'speech'>

const createSpeech = (
  transactionID: number | string,
  data: Omit<SpeechCreateData, 'origin'>,
): Promise<{ id: number }> =>
  payload.create({
    collection: 'speech',
    // C215 — this spec measures the Câmara coverage.
    data: { origin: 'camara', ...data },
    depth: 0,
    req: { transactionID },
    // Intentional bypass: the spec seeds its own rows.
    overrideAccess: true,
  })

const bucketOf = (coverage: SpeechCoverage, legislature: string): SpeechLegislatureCoverage => {
  const found = coverage.byLegislature.find((row) => row.legislature === legislature)
  return (
    found ?? {
      legislature,
      total: 0,
      withExcerpt: 0,
      withVideo: 0,
      withSegments: 0,
      withoutExcerpt: 0,
      withoutSegments: 0,
      fallbackYoutube: 0,
    }
  )
}

const delta = (
  before: SpeechCoverage,
  after: SpeechCoverage,
  legislature: string,
): Omit<SpeechLegislatureCoverage, 'legislature'> => {
  const from = bucketOf(before, legislature)
  const to = bucketOf(after, legislature)
  return {
    total: to.total - from.total,
    withExcerpt: to.withExcerpt - from.withExcerpt,
    withVideo: to.withVideo - from.withVideo,
    withSegments: to.withSegments - from.withSegments,
    withoutExcerpt: to.withoutExcerpt - from.withoutExcerpt,
    withoutSegments: to.withoutSegments - from.withoutSegments,
    fallbackYoutube: to.fallbackYoutube - from.fallbackYoutube,
  }
}

describe('getSpeechCoverage (C155)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('counts the buckets per legislature and derives the complements', async () => {
    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null) throw new Error('Não foi possível abrir a transação do spec.')
    try {
      const database = await getPostgresTransactionDatabase(payload, { transactionID })
      // Fixed snapshot: the delta between the two reads cannot be moved by
      // parallel specs committing their own fixtures.
      await database.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`)
      const before = await getSpeechCoverage(payload, { transactionID })

      const withSegments = await createSpeech(transactionID, {
        sourceKey: `coverage-${randomUUID()}`,
        speechAt: '2012-05-01T10:00',
        year: 2012,
        legislature: '54',
        classifiedBy: 'gazetteer',
        audioId: 11,
        excerptTMs: 1_000,
        vodPlaybackUrl: 'https://vod/a',
        vodDownloadUrl: 'https://vod/a.mp4',
      })
      await payload.create({
        collection: 'speechSegment',
        data: {
          speech: withSegments.id,
          order: 1,
          startSeconds: 0,
          endSeconds: 2,
          text: 'a saúde pública baiana',
          searchText: 'a saude publica baiana',
        },
        depth: 0,
        req: { transactionID },
        // Intentional bypass: the spec seeds its own rows.
        overrideAccess: true,
      })
      // Excerpt identified, VOD absent, no segments (the C153 "sem segmentos" gap).
      await createSpeech(transactionID, {
        sourceKey: `coverage-${randomUUID()}`,
        speechAt: '2012-06-01T10:00',
        year: 2012,
        legislature: '54',
        classifiedBy: 'gazetteer',
        audioId: 12,
        excerptTMs: 2_000,
      })
      // No excerpt at all, but the event has a YouTube record (fallback bucket).
      await createSpeech(transactionID, {
        sourceKey: `coverage-${randomUUID()}`,
        speechAt: '2012-07-01T10:00',
        year: 2012,
        legislature: '54',
        classifiedBy: 'gazetteer',
        youtubeUrl: 'https://www.youtube.com/watch?v=x',
      })

      const after = await getSpeechCoverage(payload, { transactionID })
      expect(delta(before, after, '54')).toEqual({
        total: 3,
        withExcerpt: 2,
        withVideo: 1,
        withSegments: 1,
        withoutExcerpt: 1,
        withoutSegments: 2,
        fallbackYoutube: 1,
      })

      const total = after.byLegislature.reduce((sum, row) => sum + row.total, 0)
      expect(after.totals.total).toBe(total)
      expect(after.totals.withExcerpt + after.totals.withoutExcerpt).toBe(total)
      expect(after.totals.withSegments + after.totals.withoutSegments).toBe(total)
    } finally {
      await payload.db.rollbackTransaction(transactionID)
    }
  })
})
