/**
 * C242 — provisions the two Consent texts of the selfie search by their stable
 * keys (`busca-selfie-fotos` query consent, `busca-selfie-indice` public index
 * notice). Idempotent: creates the row when missing, updates the text when the
 * repo text changed (Payload versions the consent).
 *
 * Modes:
 *   pnpm seed:face-consents            plan/dry-run (default) — shows the state; no write
 *   pnpm seed:face-consents --apply    upserts the texts; requires
 *                                      FACE_CONSENT_SEED_CONFIRM=1 outside local dev
 *                                      and the declared TEQO_ENV matching the
 *                                      exact database
 *
 * The texts are versioned in `scripts/lib/faceConsentTexts.mjs` — the delivery
 * that opens the surface owns what the visitor reads.
 */
import { getPayload } from 'payload'

import { FACE_INDEX_CONSENT_KEY, FACE_SEARCH_CONSENT_KEY } from '../src/lib/campaignConsentKeys.ts'

import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
} from './lib/cli.mjs'
import {
  FACE_INDEX_CONSENT_PARAGRAPHS,
  FACE_INDEX_CONSENT_TEXT,
  FACE_SEARCH_CONSENT_PARAGRAPHS,
  FACE_SEARCH_CONSENT_TEXT,
} from './lib/faceConsentTexts.mjs'

loadCliEnv()

const die = dieWithLabel('seed:face-consents')
const WRITE_CONFIRM_FLAG = 'FACE_CONSENT_SEED_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm seed:face-consents [opções]

Cria/atualiza os dois Consentimentos da busca por selfie:
  ${FACE_SEARCH_CONSENT_KEY}   consentimento da consulta (selfie + biometria)
  ${FACE_INDEX_CONSENT_KEY}    aviso público do índice anônimo do acervo

Modos:
  (sem flag)         plano/dry-run — estado atual e prévia dos textos; sem escrita
  --apply            grava os textos (exige ${WRITE_CONFIRM_FLAG}=1 fora do dev local)

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. O plano é read-only.
`

const upsertConsent = async (payload, key, text) => {
  const existing = await payload.find({
    collection: 'consent',
    where: { key: { equals: key } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = existing.docs[0]
  if (found) {
    await payload.update({
      collection: 'consent',
      id: found.id,
      data: { text },
      depth: 0,
      overrideAccess: true,
    })
    return { id: found.id, action: 'updated' }
  }

  const created = await payload.create({
    collection: 'consent',
    data: { key, text },
    depth: 0,
    overrideAccess: true,
  })
  return { id: created.id, action: 'created' }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP)
    process.exit(0)
  }
  const unknown = argv.find((arg) => arg !== '--apply')
  if (unknown) die(`argumento desconhecido: ${unknown} — uso: pnpm seed:face-consents [--apply].`)

  const apply = argv.includes('--apply')
  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  console.log(`[seed:face-consents] alvo: ${databaseTarget()} | modo: ${apply ? 'apply' : 'plan'}`)

  if (apply) {
    assertWriteConfirm({
      label: 'seed:face-consents',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm seed:face-consents --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const entries = [
    {
      key: FACE_SEARCH_CONSENT_KEY,
      text: FACE_SEARCH_CONSENT_TEXT,
      paragraphs: FACE_SEARCH_CONSENT_PARAGRAPHS,
    },
    {
      key: FACE_INDEX_CONSENT_KEY,
      text: FACE_INDEX_CONSENT_TEXT,
      paragraphs: FACE_INDEX_CONSENT_PARAGRAPHS,
    },
  ]

  for (const entry of entries) {
    const existing = await payload.find({
      collection: 'consent',
      where: { key: { equals: entry.key } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const state = existing.docs[0] ? `existe (#${existing.docs[0].id})` : 'ausente'
    console.log(
      `[seed:face-consents] ${entry.key}: ${state} | texto com ${entry.paragraphs.length} parágrafo(s)`,
    )

    if (!apply) continue
    const result = await upsertConsent(payload, entry.key, entry.text)
    console.log(`[seed:face-consents] ${entry.key}: ${result.action} (#${result.id})`)
  }

  if (!apply) {
    console.log('\n[seed:face-consents] dry-run — use --apply para gravar.')
    process.exit(0)
  }
  console.log('\n[seed:face-consents] OK — Consentimentos da busca por selfie provisionados.')
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
