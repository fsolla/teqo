/**
 * Staging test account (OPS125) — the ONE source of the synthetic `campaignUser`
 * the `work-issue` post-deploy verification (OPS121) logs in with at
 * `https://staging.jorgesolla1313.com.br`.
 *
 * Why it exists: the verification agent tried the minimal seed credentials,
 * which never exist on staging (the staging DB is a copy of production, not a
 * `db:seed:minimal` target). This module owns the account identity and the
 * fail-closed guard that keeps its creation restricted to staging.
 *
 * The password is NEVER in code — it comes from `STAGING_TEST_ACCOUNT_PASSWORD`
 * in the homeserver env file (`~/stack/teqo-staging.env`, chmod 600), so the
 * re-run is idempotent AND deterministic.
 *
 * Guard discriminators (the host alone cannot decide: the homeserver socat
 * proxy rewrites the DB host to 127.0.0.1 and the env file sets
 * `NODE_ENV=production`, so `assertLocalDatabase`/`requiresWriteConfirm` alone
 * cannot tell staging from production):
 *   1. the database NAME must be exactly `teqo_staging` (the honest signal);
 *   2. the protocol must be `postgresql:`;
 *   3. the host must still be in the local allowlist (defense in depth);
 *   4. `ALLOW_REMOTE_DB` is refused (this script never needs it);
 *   5. `TEQO_ENV`, when set, must be `staging`;
 *   6. the explicit intent flag is ALWAYS required — the bootstrap is a
 *      deliberate act, never a side effect.
 */

import {
  databaseHostname,
  databaseName,
  isLocalDatabaseUrl,
  isRemoteDbOverrideSet,
  isTruthyEnv,
} from './cli.mjs'

export const STAGING_TEST_ACCOUNT = Object.freeze({
  name: 'Agente de Teste (staging)',
  email: 'agente-teste@teqo.invalid',
  role: 'coordinator',
})

export const STAGING_DATABASE_NAME = 'teqo_staging'
export const STAGING_TEST_ACCOUNT_CONFIRM_FLAG = 'STAGING_TEST_ACCOUNT_CONFIRM'
export const STAGING_TEST_ACCOUNT_PASSWORD_ENV = 'STAGING_TEST_ACCOUNT_PASSWORD'
export const MIN_STAGING_TEST_ACCOUNT_PASSWORD_LENGTH = 16

/**
 * Fail-closed password contract: the CLI demands it before instantiating the
 * Payload runtime. Pure so the unit pin covers the exact threshold.
 *
 * @param {unknown} password
 */
export const assertStagingTestAccountPassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error(
      `${STAGING_TEST_ACCOUNT_PASSWORD_ENV} não está definida — a senha vive no env file do homeserver (chmod 600).`,
    )
  }
  if (password.length < MIN_STAGING_TEST_ACCOUNT_PASSWORD_LENGTH) {
    throw new Error(
      `${STAGING_TEST_ACCOUNT_PASSWORD_ENV} tem menos de ${MIN_STAGING_TEST_ACCOUNT_PASSWORD_LENGTH} caracteres — use uma senha sintética longa.`,
    )
  }
}

/**
 * Fail-closed guard for the staging-only write. Pure and injectable (no env
 * mutation) so the acceptance matrix is unit-pinned.
 *
 * @param {{
 *   databaseUrl?: string | null,
 *   allowRemoteDb?: boolean,
 *   teqoEnv?: string | null,
 *   confirm?: boolean,
 * }} [options]
 */
export const assertStagingTestAccountTarget = ({
  databaseUrl = process.env.DATABASE_URL,
  allowRemoteDb = isRemoteDbOverrideSet(),
  teqoEnv = process.env.TEQO_ENV,
  confirm = isTruthyEnv(process.env[STAGING_TEST_ACCOUNT_CONFIRM_FLAG]),
} = {}) => {
  const targetDatabaseName = databaseName(databaseUrl)
  if (targetDatabaseName !== STAGING_DATABASE_NAME) {
    throw new Error(
      `banco-alvo "${targetDatabaseName ?? '(inválido)'}" ≠ "${STAGING_DATABASE_NAME}" — ` +
        'este script só escreve na conta de teste do staging.',
    )
  }

  let protocol = null
  try {
    protocol = new URL(String(databaseUrl ?? '')).protocol
  } catch {
    protocol = null
  }
  if (protocol !== 'postgresql:') {
    throw new Error(
      `protocolo "${protocol ?? '(inválido)'}" ≠ "postgresql:" — a conta de teste só é criada num alvo PostgreSQL.`,
    )
  }

  if (!isLocalDatabaseUrl(databaseUrl)) {
    // Never echo the URL — it carries the DB password (reviewer finding).
    throw new Error(
      `host "${databaseHostname(databaseUrl) ?? '(inválido)'}" fora do allowlist local — a conta de teste nunca é criada em alvo remoto.`,
    )
  }

  if (allowRemoteDb) {
    throw new Error(
      'ALLOW_REMOTE_DB está setado — remova; este script nunca precisa do override remoto.',
    )
  }

  if (teqoEnv !== undefined && teqoEnv !== null && teqoEnv !== '' && teqoEnv !== 'staging') {
    throw new Error(
      `TEQO_ENV="${teqoEnv}" ≠ "staging" — este script só roda no bootstrap do staging.`,
    )
  }

  if (!confirm) {
    throw new Error(
      `confirme a intenção com ${STAGING_TEST_ACCOUNT_CONFIRM_FLAG}=1 — a conta é criada só no bootstrap deliberado do staging.`,
    )
  }
}

/**
 * Idempotent upsert of the staging test account, keyed by its unique `email`.
 * Creates on first run, then syncs `name`/`role`/`password` on every re-run
 * (the C155-style deterministic bootstrap). Never passes `contact`, so the
 * `CampaignUser` hook leaves the linked ficha untouched on updates; the first
 * `create` lets the hook materialize the synthetic `Contact`.
 *
 * Runs through the Local API without `user` — the default Payload bypass, the
 * same precedent as `scripts/seed-minimal.mjs`.
 *
 * @param {import('payload').Payload} payload
 * @param {{ password: string }} options
 * @returns {Promise<{ operation: 'created' | 'updated', id: number }>}
 */
export const upsertStagingTestAccount = async (payload, { password }) => {
  const data = {
    name: STAGING_TEST_ACCOUNT.name,
    email: STAGING_TEST_ACCOUNT.email,
    role: STAGING_TEST_ACCOUNT.role,
    password,
  }

  const existing = await payload.find({
    collection: 'campaignUser',
    where: { email: { equals: STAGING_TEST_ACCOUNT.email } },
    depth: 0,
    pagination: false,
  })

  const doc = existing.docs[0]
  if (doc) {
    const updated = await payload.update({
      collection: 'campaignUser',
      id: doc.id,
      data,
      depth: 0,
    })
    return { operation: 'updated', id: updated.id }
  }

  const created = await payload.create({ collection: 'campaignUser', data, depth: 0 })
  return { operation: 'created', id: created.id }
}
