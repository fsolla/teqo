/**
 * OPS79 — migrate the residual public write orphaned on the old platform (Neon)
 * into the new platform (`teqo_1313`).
 *
 * Verified residual (2026-08-23, read-only recon): the campaign vertical is
 * already 100% in sync after OPS51. The only orphaned record is the public
 * petition signature id 1486 — with its creator contact and subscription, which
 * `submitPetitionSignature` writes together in one transaction and which never
 * reached the target (the target's contact id 2221 is a DIFFERENT person, Jorge
 * Solla; the orphan's creator — Juares Lagimar de Souza, jlagimar@gmail.com —
 * is absent from the target).
 *
 * What this script does:
 *   - READS from Neon (read-only) the signature 1486 + its contact + phones +
 *     subscription.
 *   - FAILS CLOSED on ambiguous/missing referents in the target: petition
 *     'fim-escala-6x1' must exist, consent id 2 ('whatsapp-inscricao') must
 *     resolve by the same key, and the target must NOT already contain the same
 *     contact email. It NEVER reuses the target's contact id 2221 (different
 *     person) — the orphan contact is created with a NEW id.
 *   - Inserts into the target in ONE transaction: contact (new id), its
 *     phone row, signature (preserving id 1486 → id-join stays green), and the
 *     subscription (new id); then bumps the affected sequences.
 *
 * Safety model (mirrors recover-media.mjs):
 *   - `--apply` ESCREVE em produção e exige a flag explícita OPS79_MIGRATE_CONFIRM=1.
 *   - `--dry-run` planeja e valida SEM escrever (sem flag de confirmação).
 *   - Echo do alvo (Neon host, target host, ids planejados) antes de qualquer
 *     trabalho. PII (nome/email/telefone/comentário) é exibida só mascarada.
 *   - Deve rodar 100% no homeserver (PII nunca sai dele). Ver runbook em
 *     docs/ops/teqo-1313-deploy.md.
 *
 * Usage (no homeserver, com o env do stack):
 *   NEON_DATABASE_URL=postgres://… DATABASE_URL=postgres://… pnpm ops79:migrate --dry-run
 *   OPS79_MIGRATE_CONFIRM=1 NEON_DATABASE_URL=… DATABASE_URL=… pnpm ops79:migrate --apply
 */
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

import { dieWithLabel, isTruthyEnv, loadCliEnv } from './lib/cli.mjs'

const die = dieWithLabel('ops79:migrate')

loadCliEnv()

const CONFIRM_FLAG = 'OPS79_MIGRATE_CONFIRM'

const args = new Set(process.argv.slice(2))
const unknown = [...args].filter((a) => a !== '--dry-run' && a !== '--apply')
if (unknown.length > 0) die(`argumento desconhecido: ${unknown.join(', ')}`)
if (args.size > 1) die('modos são mutuamente exclusivos: use apenas um de --dry-run / --apply.')
const mode = args.has('--apply') ? 'apply' : 'dry-run'

if (mode === 'apply' && !isTruthyEnv(process.env[CONFIRM_FLAG])) {
  die(
    'modo --apply ESCREVE em produção — exige confirmação explícita de intenção.\n' +
      `  Re-rodar com: ${CONFIRM_FLAG}=1 pnpm ops79:migrate --apply\n` +
      '  (ou use --dry-run para planejar e validar sem escrever).',
  )
}

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL
const TARGET_DATABASE_URL = process.env.DATABASE_URL
if (!NEON_DATABASE_URL) die('NEON_DATABASE_URL is not set (fonte: ~/stack/.env no homeserver).')
if (!TARGET_DATABASE_URL) die('DATABASE_URL is not set (target teqo_1313).')

const ORPHAN_SIGNATURE_ID = 1486

const mask = (s) => (s === null || s === undefined ? '' : `…${String(s).slice(-4)}`)
const maskEmail = (s) =>
  s === null || s === undefined ? '' : `${s.split('@')[0].slice(0, 2)}…@${s.split('@')[1] ?? ''}`

const connectReadOnly = async (url) => {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
  await c.connect()
  await c.query('SET default_transaction_read_only = on')
  await c.query('SET statement_timeout = 30000')
  return c
}

const connectWritable = async (url) => {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
  await c.connect()
  return c
}

async function readOrphan(neon) {
  const sig = await neon.query('SELECT * FROM signature WHERE id = $1', [ORPHAN_SIGNATURE_ID])
  if (sig.rows.length !== 1) die(`signature ${ORPHAN_SIGNATURE_ID} não encontrada na origem.`)
  const s = sig.rows[0]

  const contact = await neon.query('SELECT * FROM contact WHERE id = $1', [s.contact_id])
  const c = contact.rows[0]
  if (!c) die(`contato ${s.contact_id} da signature ${ORPHAN_SIGNATURE_ID} não existe na origem.`)

  const phones = await neon.query(
    'SELECT _order, value FROM contact_phones WHERE _parent_id = $1 ORDER BY _order',
    [s.contact_id],
  )
  const sub = await neon.query('SELECT * FROM subscription WHERE contact_id = $1', [s.contact_id])

  // Source consent key (fail-closed check on the target side).
  const consent = await neon.query('SELECT id, "key" FROM consent WHERE id = $1', [s.consent_id])
  return {
    signature: { ...s, consent_key: consent.rows[0]?.key ?? null },
    contact: c,
    phones: phones.rows,
    subscription: sub.rows[0] ?? null,
  }
}

async function validateTarget(target, orphan) {
  const errors = []

  const petition = await target.query('SELECT id, form_consent_id FROM petition WHERE id = $1', [
    orphan.signature.petition_id,
  ])
  if (petition.rows.length !== 1)
    errors.push(`petition '${orphan.signature.petition_id}' ausente no target`)
  else if (Number(petition.rows[0].form_consent_id) !== Number(orphan.signature.consent_id))
    errors.push(
      `consent do petition no target diverge do consent da signature origem ` +
        `(${petition.rows[0].form_consent_id} vs ${orphan.signature.consent_id})`,
    )

  // Fail-closed on consent meaning, not just id presence: the target must hold a
  // consent with the SAME id AND the same stable key as the source's. If the
  // source row's key is read, we enforce it; otherwise we only enforce id
  // presence (a re-seeded DB could legitimately differ).
  const srcKey =
    orphan.signature.consent_key !== undefined && orphan.signature.consent_key !== null
      ? orphan.signature.consent_key
      : null
  const consent = await target.query('SELECT id, "key" FROM consent WHERE id = $1', [
    orphan.signature.consent_id,
  ])
  if (consent.rows.length !== 1) {
    errors.push(`consent ${orphan.signature.consent_id} ausente no target`)
  } else if (srcKey !== null && consent.rows[0].key !== srcKey) {
    errors.push(
      `consent ${orphan.signature.consent_id} no target tem key '${consent.rows[0].key}' ` +
        `mas a origem tem '${srcKey}'`,
    )
  }

  const collision = await target.query('SELECT id FROM contact WHERE email = $1', [
    orphan.contact.email,
  ])
  if (collision.rows.length > 0)
    errors.push(
      `contato com email ${maskEmail(orphan.contact.email)} JÁ existe no target (id ${collision.rows[0].id})`,
    )

  const sigFree = await target.query('SELECT 1 FROM signature WHERE id = $1', [ORPHAN_SIGNATURE_ID])
  if (sigFree.rows.length > 0)
    errors.push(`signature id ${ORPHAN_SIGNATURE_ID} já ocupado no target`)

  if (errors.length > 0) die(`precondições do target falharam:\n  - ${errors.join('\n  - ')}`)
  return {
    petitionId: orphan.signature.petition_id,
    consentId: Number(orphan.signature.consent_id),
  }
}

async function main() {
  console.log(`[ops79:migrate] Neon  (origem)  : ${new URL(NEON_DATABASE_URL).host}`)
  console.log(`[ops79:migrate] Target (destino): ${new URL(TARGET_DATABASE_URL).host}`)
  console.log(`[ops79:migrate] Modo: ${mode}`)

  const neon = await connectReadOnly(NEON_DATABASE_URL)
  const orphan = await readOrphan(neon)
  await neon.end()

  const target = await connectWritable(TARGET_DATABASE_URL)
  const refs = await validateTarget(target, orphan)

  const srcSub = orphan.subscription
  const newContactId = (await target.query('SELECT COALESCE(max(id), 0) + 1 AS next FROM contact'))
    .rows[0].next
  const newSubId = srcSub
    ? (await target.query('SELECT COALESCE(max(id), 0) + 1 AS next FROM subscription')).rows[0].next
    : null

  console.log(`\n[ops79:migrate] PLANO (${mode}):`)
  console.log(
    `  contact  (novo id ${newContactId}): ${mask(orphan.contact.name)} ${maskEmail(orphan.contact.email)} BA/${orphan.contact.city ?? ''} cep ${mask(orphan.contact.postal_code ?? '')} phones=${orphan.phones.length}`,
  )
  console.log(
    `  signature (id ${ORPHAN_SIGNATURE_ID} preservado): petition=${refs.petitionId} consent=${refs.consentId} comment(${orphan.signature.comment?.length ?? 0} caracteres)`,
  )
  if (srcSub) console.log(`  subscription (novo id ${newSubId}): consent=${refs.consentId}`)

  if (mode === 'dry-run') {
    console.log(
      `\n[ops79:migrate] dry-run OK — nenhuma escrita. Para aplicar: ${CONFIRM_FLAG}=1 pnpm ops79:migrate --apply`,
    )
    await target.end()
    process.exit(0)
  }

  try {
    await target.query('BEGIN')

    await target.query(
      `INSERT INTO contact (id, name, email, gender, state, city, postal_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newContactId,
        orphan.contact.name,
        orphan.contact.email,
        orphan.contact.gender,
        orphan.contact.state,
        orphan.contact.city,
        orphan.contact.postal_code,
        orphan.contact.created_at,
        orphan.contact.updated_at,
      ],
    )

    for (const phone of orphan.phones) {
      await target.query(
        `INSERT INTO contact_phones (id, _parent_id, _order, value)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), newContactId, phone._order ?? 0, phone.value],
      )
    }

    await target.query(
      `INSERT INTO signature (id, contact_id, petition_id, consent_id, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ORPHAN_SIGNATURE_ID,
        newContactId,
        refs.petitionId,
        refs.consentId,
        orphan.signature.comment,
        orphan.signature.created_at,
        orphan.signature.updated_at,
      ],
    )

    if (srcSub) {
      await target.query(
        `INSERT INTO subscription (id, contact_id, consent_id, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newSubId,
          newContactId,
          refs.consentId,
          srcSub.comment,
          srcSub.created_at,
          srcSub.updated_at,
        ],
      )
    }

    // Bring sequences past the explicit ids so future Payload inserts don't collide.
    // `true` = the value IS already counted, so the next nextval() is id+1.
    await target.query(`SELECT setval('contact_id_seq', $1, true)`, [newContactId])
    await target.query(`SELECT setval('signature_id_seq', $1, true)`, [ORPHAN_SIGNATURE_ID])
    if (newSubId) await target.query(`SELECT setval('subscription_id_seq', $1, true)`, [newSubId])

    await target.query('COMMIT')
    console.log(
      `\n[ops79:migrate] OK — aplicado. contact=${newContactId}, signature=${ORPHAN_SIGNATURE_ID}, phones=${orphan.phones.length}, subscription=${srcSub ? newSubId : 'não'}.`,
    )
    console.log(
      '[ops79:migrate] Verificar depois com: pnpm ops79:reconcile (vertical diff 0; ' +
        'signature/contact contagens sobem conforme o plano).',
    )
  } catch (err) {
    await target.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await target.end()
  }

  process.exit(0)
}

main().catch((err) => {
  die(err?.message || String(err))
})
