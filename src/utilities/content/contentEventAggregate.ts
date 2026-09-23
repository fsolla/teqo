import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { ContentEventAggregateRow, ContentEventSubjectType } from '@/lib/contentEvents'
import { drizzleResultRows, getPayloadDrizzle } from '@/utilities/drizzleBulk'

/**
 * C213 — reads the anonymous counters of a page of subjects in ONE query (a
 * `payload.count` per row would be an N+1 on a 25-row list). Grouping is by
 * `subject_id` + `type`, so the caller gets the four counters per subject; the
 * subject type is a parameter, which is what lets S32 read card counters from
 * the same mechanism.
 *
 * The raw SQL has no access control of its own: the gate is the CALLER — the
 * internal loaders run after the page actor gate (`requireCampaignPageActor`)
 * with `overrideAccess: false`, and only ever ask for the ids they just read.
 * The read never throws: a failure answers `{ ok: false }` and the surfaces
 * render the design's "contagem indisponível" state instead of failing the
 * page (the list is the assessoria's workbench — it must never depend on the
 * counters it displays).
 */

export type ContentEventAggregateResult =
  | { ok: true; rows: ContentEventAggregateRow[] }
  | { ok: false }

export const loadContentEventCountsBySubject = async (
  payload: Pick<Payload, 'db'>,
  {
    subjectType,
    subjectIds,
  }: { subjectType: ContentEventSubjectType; subjectIds: readonly string[] },
): Promise<ContentEventAggregateResult> => {
  if (subjectIds.length === 0) return { ok: true, rows: [] }

  const drizzle = getPayloadDrizzle(payload)
  if (!drizzle) return { ok: false }

  try {
    const result = await drizzle.execute(sql`
      SELECT "subject_id", "type", COUNT(*)::int AS "count"
      FROM "content_event"
      WHERE "subject_type" = ${subjectType}
        AND "subject_id" IN (${sql.join(
          subjectIds.map((subjectId) => sql`${subjectId}`),
          sql`, `,
        )})
      GROUP BY "subject_id", "type"
    `)

    return {
      ok: true,
      rows: drizzleResultRows(result).map((row) => ({
        subjectId: String(row.subject_id ?? ''),
        type: String(row.type ?? ''),
        count: Number(row.count ?? 0),
      })),
    }
  } catch (error) {
    // Fail-soft, but not silent: the "—" state on screen traces back to this.
    console.warn('[contentEvent] falha ao agregar contadores anônimos', {
      subjectType,
      error,
    })
    return { ok: false }
  }
}
