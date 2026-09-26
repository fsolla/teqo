/**
 * C195 — pure rules of `pnpm reels:ingest`: CLI parsing, the fail-closed target
 * guard and the package reader/validator. No Payload and no `server-only`: the
 * CLI (`scripts/reels-ingest.mjs`) and the int spec share it, and the unit pin
 * covers the refusal matrix.
 *
 * The package contract itself (filenames, kinds, required flag, metadata keys,
 * stored names/mimetypes/alts) lives in `src/lib/reel.ts`, the owner of the
 * reel vocabulary that the production skill and the writer also read.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

import {
  REEL_FEATURES,
  REEL_PACKAGE_ARTIFACTS,
  REEL_PACKAGE_METADATA_FILENAME,
  REEL_PACKAGE_METADATA_KEYS,
  REEL_PACKAGE_TRANSCRIPT_FILENAME,
  REEL_TITLE_MAX_LENGTH,
  reelMediaFieldByKind,
} from '../../src/lib/reel.ts'

import { assertEnvironmentDatabaseTarget, isTruthyEnv, parseEqualsFlags } from './cli.mjs'

/** Explicit write-intent flag; dry-run (the default) never needs it. */
export const REELS_INGEST_CONFIRM_FLAG = 'REELS_INGEST_CONFIRM'

const USAGE = 'uso: `pnpm reels:ingest <diretório> [--apply]`'

/** Identity hash of the shot list written by the production skill (sha256 hex). */
const REEL_INGEST_SHOT_LIST_HASH_RE = /^[a-f0-9]{64}$/

/**
 * Fail-closed write gate: `--apply` only proceeds with the explicit intent
 * flag. Pure and injectable so the unit pin covers the refusal.
 *
 * @param {{ apply?: boolean, confirm?: boolean }} [options]
 */
export const assertReelIngestApplyConfirm = ({
  apply = false,
  confirm = isTruthyEnv(process.env[REELS_INGEST_CONFIRM_FLAG]),
} = {}) => {
  if (!apply || confirm) return
  throw new Error(
    'modo --apply ESCREVE na biblioteca — exige confirmação explícita de intenção.\n' +
      `  Re-rodar com: ${REELS_INGEST_CONFIRM_FLAG}=1 pnpm reels:ingest <diretório> --apply\n` +
      '  (sem --apply o comando só confere e mostra o que seria criado ou atualizado).',
  )
}

/**
 * `pnpm reels:ingest <diretório> [--apply]` argv parser. The directory is the
 * one positional; `--apply` is the only flag (bare, no value). Errors carry the
 * usage so the CLI can `die` with them.
 *
 * @param {string[]} [argv]
 * @returns {{ directory: string, apply: boolean }}
 */
export const parseReelIngestArgs = (argv = process.argv.slice(2)) => {
  const { flags, positional } = parseEqualsFlags(argv)
  const unknown = Object.keys(flags).filter((flag) => flag !== 'apply')
  if (unknown.length > 0) {
    throw new Error(
      `argumento desconhecido: ${unknown.map((flag) => `--${flag}`).join(', ')} — ${USAGE}.`,
    )
  }
  if (flags.apply !== undefined && flags.apply !== true) {
    throw new Error(`--apply não aceita valor — ${USAGE}.`)
  }
  if (positional.length === 0) {
    throw new Error(`informe o diretório do pacote — ${USAGE}.`)
  }
  if (positional.length > 1) {
    throw new Error(
      `argumento posicional extra: ${positional.slice(1).join(', ')} — o pacote é um único diretório; ${USAGE}.`,
    )
  }
  return { directory: positional[0], apply: flags.apply === true }
}

/**
 * Fail-closed target guard. Outside a test run the declared `TEQO_ENV`
 * (`staging`|`production`) is mandatory and must match the exact database name;
 * inside vitest only a `teqo*_test` database is accepted. `ALLOW_REMOTE_DB` is
 * always refused — the ingest never runs from a workstation against a remote
 * database. The rule lives once in `cli.mjs` (`assertEnvironmentDatabaseTarget`,
 * C231); this alias keeps the C195 name and contract.
 *
 * @param {{
 *   databaseUrl?: string | null,
 *   teqoEnv?: string | null,
 *   allowRemoteDb?: boolean,
 *   isTest?: boolean,
 * }} [options]
 * @returns {{ environment: 'staging' | 'production' | 'test', databaseName: string }}
 */
export const assertReelIngestTarget = (options = {}) => assertEnvironmentDatabaseTarget(options)

/**
 * All reasons a parsed metadata + file listing is not a valid package. Empty
 * array means valid; the reader joins the list into one error.
 *
 * @param {{ metadata: unknown, fileNames: Set<string> }} input
 * @returns {string[]}
 */
export const reelPackageIssues = ({ metadata, fileNames }) => {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [`${REEL_PACKAGE_METADATA_FILENAME} deve conter um objeto JSON.`]
  }

  const issues = []
  const keys = REEL_PACKAGE_METADATA_KEYS

  const title = metadata[keys.title]
  if (typeof title !== 'string' || title.trim() === '') {
    issues.push(`${keys.title} ausente ou vazio.`)
  } else if (title.length > REEL_TITLE_MAX_LENGTH) {
    issues.push(`${keys.title} excede ${REEL_TITLE_MAX_LENGTH} caracteres.`)
  }

  const feature = metadata[keys.feature]
  if (!REEL_FEATURES.includes(feature)) {
    issues.push(
      `${keys.feature} "${String(feature)}" fora do vocabulário (${REEL_FEATURES.join(', ')}).`,
    )
  }

  const shotListHash = metadata[keys.shotListHash]
  if (typeof shotListHash !== 'string' || !REEL_INGEST_SHOT_LIST_HASH_RE.test(shotListHash)) {
    issues.push(`${keys.shotListHash} deve ser um sha256 hex (64 caracteres minúsculos).`)
  }

  const coverAlt = metadata[keys.coverAlt]
  if (typeof coverAlt !== 'string' || coverAlt.trim() === '') {
    issues.push(`${keys.coverAlt} ausente ou vazio.`)
  }

  const durationSeconds = metadata[keys.durationSeconds]
  if (
    durationSeconds !== undefined &&
    durationSeconds !== null &&
    (typeof durationSeconds !== 'number' ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0)
  ) {
    issues.push(`${keys.durationSeconds} inválido (segundos positivos).`)
  }

  const createdAt = metadata[keys.createdAt]
  if (
    createdAt !== undefined &&
    createdAt !== null &&
    (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt)))
  ) {
    issues.push(`${keys.createdAt} inválido (data ISO 8601).`)
  }

  for (const artifact of REEL_PACKAGE_ARTIFACTS) {
    if (artifact.required && !fileNames.has(artifact.filename)) {
      issues.push(`artefato obrigatório ausente: ${artifact.filename}.`)
    }
  }

  return issues
}

/**
 * Reads and validates one package directory. Throws with every pending item so
 * the operator fixes the package in one pass; never touches the database.
 *
 * @param {string} directory
 * @returns {Promise<{
 *   directory: string,
 *   metadata: Record<string, unknown>,
 *   artifacts: Array<{
 *     filename: string,
 *     kind: string,
 *     field: string,
 *     required: boolean,
 *     present: boolean,
 *     path: string,
 *   }>,
 *   transcriptPath: string | null,
 * }>}
 */
export const readReelPackage = async (directory) => {
  const directoryStat = await stat(directory).catch(() => null)
  if (!directoryStat?.isDirectory()) {
    throw new Error(`diretório do pacote inválido: ${directory}`)
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))

  if (!fileNames.has(REEL_PACKAGE_METADATA_FILENAME)) {
    throw new Error(`pacote incompleto: ${REEL_PACKAGE_METADATA_FILENAME} não encontrado.`)
  }

  let metadata
  try {
    metadata = JSON.parse(await readFile(join(directory, REEL_PACKAGE_METADATA_FILENAME), 'utf8'))
  } catch (error) {
    throw new Error(
      `${REEL_PACKAGE_METADATA_FILENAME} ilegível: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const issues = reelPackageIssues({ metadata, fileNames })
  if (issues.length > 0) {
    throw new Error(`pacote inválido:\n  - ${issues.join('\n  - ')}`)
  }

  const artifacts = REEL_PACKAGE_ARTIFACTS.map((artifact) => ({
    ...artifact,
    field: reelMediaFieldByKind[artifact.kind],
    present: fileNames.has(artifact.filename),
    path: join(directory, artifact.filename),
  }))

  const emptyArtifacts = []
  for (const artifact of artifacts) {
    if (!artifact.present) continue
    const artifactStat = await stat(artifact.path).catch(() => null)
    if (artifactStat === null || !artifactStat.isFile() || artifactStat.size === 0) {
      emptyArtifacts.push(artifact.filename)
    }
  }
  if (emptyArtifacts.length > 0) {
    throw new Error(
      `pacote inválido:\n  - artefato vazio ou ilegível: ${emptyArtifacts.join(', ')}.`,
    )
  }

  return {
    directory,
    metadata,
    artifacts,
    transcriptPath: fileNames.has(REEL_PACKAGE_TRANSCRIPT_FILENAME)
      ? join(directory, REEL_PACKAGE_TRANSCRIPT_FILENAME)
      : null,
  }
}
