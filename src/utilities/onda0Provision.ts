import 'server-only'

import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import {
  ONDA0_CONSENT_ENTRIES,
  ONDA0_CONSENT_KEY_LIST,
  ONDA0_PRIVACY_POLICY_BODY,
} from '@/lib/onda0ConsentTexts'

type Db = MigrateUpArgs['db']

export const provisionOnda0ConsentAndPrivacyDb = async (db: Db): Promise<void> => {
  for (const { key, text } of ONDA0_CONSENT_ENTRIES) {
    const textJson = JSON.stringify(text)
    await db.execute(sql`
      INSERT INTO "consent" ("key", "text", "created_at", "updated_at")
      VALUES (${key}, ${textJson}::jsonb, now(), now())
      ON CONFLICT ("key") DO UPDATE SET
        "text" = EXCLUDED."text",
        "updated_at" = now();
    `)
  }

  const bodyJson = JSON.stringify(ONDA0_PRIVACY_POLICY_BODY)
  await db.execute(sql`DELETE FROM "privacy_policy";`)
  await db.execute(sql`
    INSERT INTO "privacy_policy" ("published", "body", "created_at", "updated_at")
    VALUES (true, ${bodyJson}::jsonb, now(), now());
  `)
}

export const removeOnda0ConsentAndPrivacyDb = async (db: Db): Promise<void> => {
  await db.execute(sql`
    DELETE FROM "consent" WHERE "key" IN (${sql.join(
      ONDA0_CONSENT_KEY_LIST.map((key) => sql`${key}`),
      sql`, `,
    )});
  `)
  await db.execute(sql`UPDATE "privacy_policy" SET "published" = false, "updated_at" = now();`)
}

export const provisionOnda0ConsentAndPrivacy = async (payload: Payload): Promise<void> => {
  const existing = await payload.find({
    collection: 'consent',
    where: { key: { in: [...ONDA0_CONSENT_KEY_LIST] } },
    depth: 0,
    limit: ONDA0_CONSENT_KEY_LIST.length,
    pagination: false,
    overrideAccess: true,
  })
  const byKey = new Map(existing.docs.map((doc) => [doc.key, doc]))

  for (const { key, text } of ONDA0_CONSENT_ENTRIES) {
    const doc = byKey.get(key)
    if (doc) {
      await payload.update({
        collection: 'consent',
        id: doc.id,
        data: { text },
        overrideAccess: true,
      })
      continue
    }

    await payload.create({
      collection: 'consent',
      data: { key, text },
      overrideAccess: true,
    })
  }

  await payload.updateGlobal({
    slug: 'privacy-policy',
    data: {
      body: ONDA0_PRIVACY_POLICY_BODY,
      published: true,
    },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
}
