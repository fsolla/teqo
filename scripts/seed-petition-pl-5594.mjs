/**
 * S48 — provisions the PL 5594/2026 petition (`pl-5594-2026`).
 *
 * The petition is editorial content: production historically only had the three
 * petitions restored from the old platform (edited in the admin), so a fresh
 * database has no reproducible path to the new one. This seed writes the content
 * versioned in `scripts/lib/petitionPl5594Content.mjs`.
 *
 * Contract:
 *   - dry-run (default): resolves the target/Consent and reports the plan; no write
 *   - `--apply`: creates the petition only when the id is missing. An existing row
 *     is never overwritten — after the first write the admin owns the content.
 *   - the Consent is the existing `whatsapp-inscricao` document, resolved by
 *     stable key (`getConsentByKey`), fail-closed when absent.
 *   - `--apply` outside a provably local dev database requires
 *     `PETITION_SEED_CONFIRM=1` and a `TEQO_ENV` matching the exact database
 *     (staging → `teqo_staging`, production → `teqo_1313`).
 *
 * After a production seed the page may still serve a cached 404 until the server
 * restarts/redeploys (or the petition is saved once in the admin): the seed runs
 * outside the Next runtime and cannot bust `document_petition:<id>`.
 *
 * Usage:
 *   pnpm seed:petition-pl-5594
 *   pnpm seed:petition-pl-5594 --apply
 *   TEQO_ENV=production PETITION_SEED_CONFIRM=1 pnpm seed:petition-pl-5594 --apply
 */
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import { getPayload } from 'payload'

import {
  PETITION_BODY_HTML,
  PETITION_BODY_SECTIONS,
  PETITION_CONSENT_KEY,
  PETITION_FORM_SUBTITLE,
  PETITION_FORM_TITLE,
  PETITION_ID,
  PETITION_SUBTITLE,
  PETITION_TITLE,
} from './lib/petitionPl5594Content.mjs'

import {
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseName,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  requiresWriteConfirm,
  TEQO_ENV_DATABASE_BY_ENV,
} from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('seed:petition-pl-5594')
const WRITE_CONFIRM_FLAG = 'PETITION_SEED_CONFIRM'

const HELP = `
Uso: pnpm seed:petition-pl-5594 [--apply]

Cria a petição "${PETITION_ID}" (abaixo-assinado do PL 5594/2026), ativa e
publicada, com o Consent existente "${PETITION_CONSENT_KEY}" resolvido por chave.

Modos:
  (sem flag)   plano/dry-run — alvo, Consent e estado atual; sem escrita
  --apply      cria a petição se o id não existir (nunca sobrescreve)

Ambiente:
  DATABASE_URL alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV
casando o banco exato (staging=teqo_staging | production=teqo_1313).
`

/**
 * `draft: true` is what makes the lookup honest: a draft-only row with the same
 * id (the admin create view generates one during render) would otherwise be
 * invisible and the create would die on a duplicate key instead of no-op.
 */
const findPetition = async (payload, id) => {
  const result = await payload.find({
    collection: 'petition',
    where: { id: { equals: id } },
    draft: true,
    limit: 1,
    depth: 0,
    pagination: false,
  })
  return result.docs[0] ?? null
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP)
    process.exit(0)
  }
  const unknown = argv.find((arg) => arg !== '--apply')
  if (unknown)
    die(`argumento desconhecido: ${unknown} — uso: pnpm seed:petition-pl-5594 [--apply].`)

  const apply = argv.includes('--apply')
  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  console.log(
    `[seed:petition-pl-5594] alvo: ${databaseTarget()} | modo: ${apply ? 'apply' : 'plan'}`,
  )

  if (apply) {
    assertWriteConfirm({
      label: 'seed:petition-pl-5594',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm seed:petition-pl-5594 --apply',
    })
    // A worktree dev database is provably local and follows the write-confirm
    // policy (no flag). But the homeserver proxy rewrites the host to localhost,
    // so a local host carrying a declared target name (teqo_1313/teqo_staging)
    // must still declare the exact environment — the name is the discriminator.
    const targetName = databaseName(process.env.DATABASE_URL)
    const declaredTargets = Object.values(TEQO_ENV_DATABASE_BY_ENV)
    if (requiresWriteConfirm() || declaredTargets.includes(targetName)) {
      assertEnvironmentDatabaseTarget()
    }
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const existing = await findPetition(payload, PETITION_ID)
  if (existing) {
    console.log(
      `[seed:petition-pl-5594] ${PETITION_ID}: existe — enabled=${Boolean(existing.enabled)} ` +
        `_status=${existing._status ?? '(sem drafts)'}; não sobrescreve (o admin é dono).`,
    )
    if (!existing.enabled || existing._status !== 'published') {
      console.log(
        '[seed:petition-pl-5594] atenção: a petição existe mas não está ativa/publicada; ' +
          'ajuste no admin (o seed nunca sobrescreve).',
      )
    }
    process.exit(0)
  }

  const { getConsentByKey } = await import('../src/utilities/campaignConsent.ts')
  const consent = await getConsentByKey(payload, PETITION_CONSENT_KEY)
  if (!consent) {
    die(
      `Consent "${PETITION_CONSENT_KEY}" ausente — a petição não pode ser criada sem ele ` +
        '(fail-closed). Rode `pnpm db:seed:minimal` no ambiente local ou confira o Consent ' +
        'de produção antes de aplicar.',
    )
  }
  console.log(
    `[seed:petition-pl-5594] Consent "${PETITION_CONSENT_KEY}": #${consent.id} (resolvido por chave)`,
  )

  console.log(
    `[seed:petition-pl-5594] ${PETITION_ID}: ausente | ${PETITION_BODY_SECTIONS.length} bloco(s) de corpo | ` +
      `título "${PETITION_TITLE}"`,
  )

  if (!apply) {
    console.log('\n[seed:petition-pl-5594] dry-run — use --apply para criar a petição.')
    process.exit(0)
  }

  const editorConfig = await editorConfigFactory.default({ config: payload.config })
  const body = convertHTMLToLexical({ editorConfig, html: PETITION_BODY_HTML, JSDOM })
  const created = await payload.create({
    collection: 'petition',
    data: {
      id: PETITION_ID,
      title: PETITION_TITLE,
      subtitle: PETITION_SUBTITLE,
      enabled: true,
      body,
      form: {
        title: PETITION_FORM_TITLE,
        subtitle: PETITION_FORM_SUBTITLE,
        consent: consent.id,
      },
      _status: 'published',
    },
    depth: 0,
    // Operator CLI: the create must write the petition even though the
    // collection's create access is admin-only (same intent as the seeds).
    overrideAccess: true,
  })
  console.log(
    `[seed:petition-pl-5594] ${PETITION_ID}: criada (#${created.id}) ` +
      `enabled=${Boolean(created.enabled)} _status=${created._status ?? '(sem drafts)'}.`,
  )
  console.log(
    '[seed:petition-pl-5594] Em produção, reinicie/redeploye o container (ou salve a petição uma vez ' +
      'no admin) antes de divulgar: o seed não busta o cache document_petition da rota.',
  )
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
