/**
 * Minimal synthetic campaign database for agents, Cursor Cloud and PR CI.
 *
 * Populates ONLY the rows the app refuses to boot/test without — everything is
 * synthetic (`.invalid` emails, 719999999Xx phones) and idempotent (upsert by
 * key/slug/email/username/phone). Municipalities are NOT created: migrations
 * seed the full 435-row catalog; this script only pins deterministic strategy
 * fields on the five listed in the manifest.
 *
 * The content contract lives in `scripts/lib/seed-minimal-manifest.mjs` and is
 * pinned by `tests/unit/seedMinimalManifest.unit.spec.ts`. CONTRACT: a delivery
 * that adds a migration, collection, Consent key or required boot data must
 * update the manifest in the same PR — PR CI runs migrate → seed:minimal →
 * test:int, so a broken seed fails the gate.
 *
 * Safety: refuses non-local DATABASE_URL unless ALLOW_REMOTE_DB=true. Agents
 * and Cloud environments must never set that override.
 *
 * Usage:
 *   pnpm migrate && pnpm db:seed:minimal
 */

import { getPayload } from 'payload'
import { assertLocalDatabase } from './assert-local-database.mjs'
import { loadCliEnv } from './lib/cli.mjs'
import {
  MINIMAL_CAMPAIGN_GOALS,
  MINIMAL_CAMPAIGN_USERS,
  MINIMAL_CONSENT_KEYS,
  MINIMAL_LEADERSHIPS,
  MINIMAL_MUNICIPALITIES,
  MINIMAL_ORGANIZATION,
  MINIMAL_STATE_DEPUTY,
  MINIMAL_SUPPORTERS,
} from './lib/seed-minimal-manifest.mjs'

loadCliEnv()

assertLocalDatabase(
  'seed:minimal',
  'This script upserts synthetic rows. It must never run against stage/prod.',
)

const config = (await import('../src/payload.config.ts')).default
const { provisionOnda0ConsentAndPrivacy } = await import('../src/utilities/onda0Provision.ts')
const { hashConsentContent } = await import('../src/utilities/consentContentHash.ts')
const { WHATSAPP_SUBSCRIPTION_CONSENT_KEY } = await import('../src/lib/campaignConsentKeys.ts')

const payload = await getPayload({ config })

const minimalLexical = (text) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

const findOne = async (collection, where) => {
  const result = await payload.find({ collection, where, depth: 0, limit: 1, pagination: false })
  return result.docs[0]
}

const upsert = async (collection, where, data, label) => {
  const existing = await findOne(collection, where)
  if (existing) {
    console.log(`[seed:minimal] ok (exists) ${label}`)
    return existing
  }
  const created = await payload.create({ collection, data, depth: 0 })
  console.log(`[seed:minimal] created ${label}`)
  return created
}

const municipalityIdBySlug = async (slug) => {
  const doc = await findOne('municipality', { slug: { equals: slug } })
  if (!doc) {
    throw new Error(
      `Municipality "${slug}" missing — run pnpm migrate before pnpm db:seed:minimal.`,
    )
  }
  return doc.id
}

try {
  // 1. Consent keys (fail-closed flows refuse to run without them). The Onda 0
  //    provision covers three of the four keys + the privacy-policy global;
  //    whatsapp-inscricao is upserted here with the same minimal text.
  await provisionOnda0ConsentAndPrivacy(payload)
  const whatsappText = minimalLexical(
    'Autorizo o recebimento de mensagens da campanha via WhatsApp (texto sintético do seed mínimo).',
  )
  await upsert(
    'consent',
    { key: { equals: WHATSAPP_SUBSCRIPTION_CONSENT_KEY } },
    { key: WHATSAPP_SUBSCRIPTION_CONSENT_KEY, text: whatsappText },
    `consent ${WHATSAPP_SUBSCRIPTION_CONSENT_KEY}`,
  )
  const consentIdByKey = new Map()
  for (const key of MINIMAL_CONSENT_KEYS) {
    const doc = await findOne('consent', { key: { equals: key } })
    if (!doc) throw new Error(`Consent "${key}" missing after provisioning.`)
    consentIdByKey.set(key, doc)
  }

  // 2. Campaign users, one per role (synthetic credentials for test DBs only).
  for (const user of MINIMAL_CAMPAIGN_USERS) {
    await upsert(
      'campaignUser',
      user.email ? { email: { equals: user.email } } : { username: { equals: user.username } },
      { ...user },
      `campaignUser ${user.role} (${user.email ?? user.username})`,
    )
  }

  // 3. Municipality strategy pins (rows come from the migration-seeded catalog).
  for (const entry of MINIMAL_MUNICIPALITIES) {
    const id = await municipalityIdBySlug(entry.slug)
    await payload.update({
      collection: 'municipality',
      id,
      data: { priority: entry.priority, expectedVotes: entry.expectedVotes },
      depth: 0,
    })
    console.log(`[seed:minimal] pinned municipality ${entry.slug}`)
  }

  // 4. Organization + state deputy.
  const organization = await upsert(
    'organization',
    { slug: { equals: MINIMAL_ORGANIZATION.slug } },
    {
      name: MINIMAL_ORGANIZATION.name,
      slug: MINIMAL_ORGANIZATION.slug,
      kind: MINIMAL_ORGANIZATION.kind,
      municipalities: await Promise.all(
        MINIMAL_ORGANIZATION.municipalitySlugs.map(municipalityIdBySlug),
      ),
    },
    `organization ${MINIMAL_ORGANIZATION.slug}`,
  )
  const stateDeputy = await upsert(
    'stateDeputy',
    { slug: { equals: MINIMAL_STATE_DEPUTY.slug } },
    { ...MINIMAL_STATE_DEPUTY },
    `stateDeputy ${MINIMAL_STATE_DEPUTY.slug}`,
  )

  // 5. Leaderships (contact upserted by phone; leadership unique by contact).
  for (const entry of MINIMAL_LEADERSHIPS) {
    const contact = await upsert(
      'contact',
      { phone: { equals: entry.contactPhone } },
      { name: entry.contactName, phone: entry.contactPhone, state: 'BA' },
      `contact ${entry.contactPhone}`,
    )
    const consent = consentIdByKey.get(entry.consentKey)
    await upsert(
      'leadership',
      { contact: { equals: contact.id } },
      {
        contact: contact.id,
        municipalities: await Promise.all(entry.municipalitySlugs.map(municipalityIdBySlug)),
        organizations: [organization.id],
        stateDeputies: [stateDeputy.id],
        supportStatus: entry.supportStatus,
        exclusive: entry.exclusive,
        consent: consent.id,
        consentContentHash: hashConsentContent(consent.text ?? null),
        consentedAt: new Date().toISOString(),
      },
      `leadership ${entry.contactName}`,
    )
  }

  // 6. Supporters (unique by contact+municipality).
  for (const entry of MINIMAL_SUPPORTERS) {
    const contact = await upsert(
      'contact',
      { phone: { equals: entry.contactPhone } },
      { name: entry.contactName, phone: entry.contactPhone, state: 'BA' },
      `contact ${entry.contactPhone}`,
    )
    const municipalityID = await municipalityIdBySlug(entry.municipalitySlug)
    const consent = consentIdByKey.get(entry.consentKey)
    const voteIntentionConsent = entry.voteIntentionConsentKey
      ? consentIdByKey.get(entry.voteIntentionConsentKey)
      : undefined
    await upsert(
      'supporter',
      { and: [{ contact: { equals: contact.id } }, { municipality: { equals: municipalityID } }] },
      {
        contact: contact.id,
        municipality: municipalityID,
        source: entry.source,
        ...(entry.voteIntention ? { voteIntention: entry.voteIntention } : {}),
        consent: consent.id,
        consentContentHash: hashConsentContent(consent.text ?? null),
        consentedAt: new Date().toISOString(),
        ...(voteIntentionConsent
          ? {
              voteIntentionConsent: voteIntentionConsent.id,
              voteIntentionConsentContentHash: hashConsentContent(
                voteIntentionConsent.text ?? null,
              ),
              voteIntentionConsentedAt: new Date().toISOString(),
            }
          : {}),
      },
      `supporter ${entry.contactName}`,
    )
  }

  // 7. Campaign goals global (E8 defaults).
  await payload.updateGlobal({
    slug: 'campaignGoals',
    data: { ...MINIMAL_CAMPAIGN_GOALS },
    overrideAccess: true,
  })
  console.log('[seed:minimal] pinned campaignGoals global')

  console.log('[seed:minimal] OK — minimal synthetic database ready.')
} catch (error) {
  console.error(`\n[seed:minimal] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

process.exit(0)
