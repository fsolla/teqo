/**
 * Read-only extraction contract (owner: the C163 report pipeline; reused by the
 * C187 institutional dossiê). Both extractors run where production lives, only
 * ever read, and refuse to guess the target: an explicit confirmation env plus
 * a connection forced read-only.
 *
 * Extracted so the actor resolution and the read-only session have one owner —
 * the institution extractor must not twin the subtle fail-closed recipe.
 */

import {
  databaseLabel,
  READ_ONLY_PG_OPTIONS,
  withReadOnlyDatabaseUrl,
} from './cityReportDatabase.mjs'
import { databaseHostname, isTruthyEnv } from './cli.mjs'

/**
 * Resolves a real campaign actor that can see everything (candidate, then
 * coordinator). `die` is injected so each CLI keeps its own label/exit.
 *
 * @param {any} payload
 * @param {{ die: (message: string) => void, roles?: string[] }} options
 * @returns {Promise<any>}
 */
export const resolveCampaignActor = async (
  payload,
  { die, roles = ['candidate', 'coordinator'] },
) => {
  for (const role of roles) {
    const result = await payload.find({
      collection: 'campaignUser',
      where: { role: { equals: role } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const doc = result.docs[0]
    if (doc) return { ...doc, collection: 'campaignUser' }
  }
  die(
    `Nenhum campaignUser com papel ${roles.join('/')} encontrado — o relatório exige um ator real que enxergue tudo.`,
  )
}

/**
 * Enforces the explicit opt-in and rewrites `DATABASE_URL` to force
 * `default_transaction_read_only=on`. Returns the raw URL (for labels).
 *
 * @param {{ confirmEnv: string, label: string, die: (message: string) => void, context?: string | null }} params
 * @returns {string | undefined}
 */
export const enterReadOnlySession = ({ confirmEnv, label, die, context = null }) => {
  if (!isTruthyEnv(process.env[confirmEnv])) {
    die(
      `Opt-in explícito ausente: rode com ${confirmEnv}=1.\n` +
        `  Alvo: ${databaseHostname(process.env.DATABASE_URL) ?? 'DATABASE_URL ausente'} — a leitura é read-only, mas o comando não adivinha o alvo.`,
    )
  }
  const rawDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = withReadOnlyDatabaseUrl(rawDatabaseUrl, READ_ONLY_PG_OPTIONS)
  console.log(
    `[${label}] alvo ${databaseLabel(rawDatabaseUrl)} · sessão read-only${context ? ` · ${context}` : ''}`,
  )
  return rawDatabaseUrl
}
