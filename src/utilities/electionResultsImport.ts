import { and, eq } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import type {
  CandidateVoteRow,
  ElectionCandidateRow,
  ElectionOffice,
  ElectionTallyRow,
  ElectionTurn,
  TseDetalheApuracaoRow,
} from '@/lib/electionResults'
import { computeWinnersByScope, mergeTallyWithWinners } from '@/lib/electionResults'
import { groupByScope } from '@/lib/electionResultsParse'

const VOTE_TABLE = 'election_candidate_vote'
const TALLY_TABLE = 'election_tally'
const CANDIDATE_TABLE = 'election_candidate'

/** ~15 columns × 500 ≈ 7500 bind params — well under PG 65535. */
const INSERT_CHUNK_SIZE = 500

export type ElectionImportScope = {
  year: number
  office: ElectionOffice
  turn: ElectionTurn
}

export type ElectionImportBundle = {
  scope: ElectionImportScope
  votes: CandidateVoteRow[]
  tallies: TseDetalheApuracaoRow[]
  candidates: ElectionCandidateRow[]
}

export type ElectionImportCounts = {
  scope: ElectionImportScope
  votesDeleted: number
  votesInserted: number
  talliesDeleted: number
  talliesInserted: number
  candidatesDeleted: number
  candidatesInserted: number
}

type DrizzleDeleteResult = { rowCount?: number | null }

type DrizzleTx = {
  delete: (table: unknown) => {
    where: (condition: unknown) => Promise<DrizzleDeleteResult>
  }
  insert: (table: unknown) => {
    values: (rows: Record<string, unknown>[]) => Promise<unknown>
  }
}

type PayloadDb = {
  drizzle: {
    transaction: <T>(fn: (tx: DrizzleTx) => Promise<T>) => Promise<T>
  }
  tables: Record<string, Record<string, unknown>>
}

const chunk = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

const getDb = (payload: Payload): PayloadDb => payload.db as unknown as PayloadDb

const requireTable = (db: PayloadDb, name: string) => {
  const table = db.tables[name]
  if (!table) throw new Error(`Tabela drizzle ausente: ${name}. Rode as migrations.`)
  return table
}

const scopeWhere = (table: Record<string, unknown>, scope: ElectionImportScope) =>
  and(
    eq(table.year as never, scope.year),
    eq(table.office as never, scope.office),
    eq(table.turn as never, scope.turn),
  )

const deleteScope = async (
  tx: DrizzleTx,
  table: Record<string, unknown>,
  scope: ElectionImportScope,
): Promise<number> => {
  // Avoid DELETE … RETURNING id (materializes every deleted row in memory on re-seed).
  const result = await tx.delete(table).where(scopeWhere(table, scope))
  return result.rowCount ?? 0
}

const nowIso = () => new Date().toISOString()

const withTimestamps = <T extends Record<string, unknown>>(row: T, now: string) => ({
  ...row,
  createdAt: now,
  updatedAt: now,
})

/**
 * Replace all election data for a single (year, office, turn) scope in one transaction:
 * delete existing rows, then bulk-insert the provided bundle.
 */
export const importElectionScope = async (
  payload: Payload,
  bundle: ElectionImportBundle,
): Promise<ElectionImportCounts> => {
  const dbAdapter = getDb(payload)
  const voteTable = requireTable(dbAdapter, VOTE_TABLE)
  const tallyTable = requireTable(dbAdapter, TALLY_TABLE)
  const candidateTable = requireTable(dbAdapter, CANDIDATE_TABLE)

  const winners = computeWinnersByScope(bundle.votes)
  const talliesWithWinners = mergeTallyWithWinners(bundle.tallies, winners)
  const now = nowIso()

  return dbAdapter.drizzle.transaction(async (tx) => {
    const votesDeleted = await deleteScope(tx, voteTable, bundle.scope)
    const talliesDeleted = await deleteScope(tx, tallyTable, bundle.scope)
    const candidatesDeleted = await deleteScope(tx, candidateTable, bundle.scope)

    for (const batch of chunk(bundle.votes, INSERT_CHUNK_SIZE)) {
      if (batch.length > 0) {
        await tx.insert(voteTable).values(batch.map((row) => withTimestamps(row, now)))
      }
    }

    for (const batch of chunk(talliesWithWinners, INSERT_CHUNK_SIZE)) {
      if (batch.length > 0) {
        await tx.insert(tallyTable).values(
          batch.map((row: ElectionTallyRow) => withTimestamps(row, now)),
        )
      }
    }

    for (const batch of chunk(bundle.candidates, INSERT_CHUNK_SIZE)) {
      if (batch.length > 0) {
        await tx.insert(candidateTable).values(batch.map((row) => withTimestamps(row, now)))
      }
    }

    return {
      scope: bundle.scope,
      votesDeleted,
      votesInserted: bundle.votes.length,
      talliesDeleted,
      talliesInserted: talliesWithWinners.length,
      candidatesDeleted,
      candidatesInserted: bundle.candidates.length,
    }
  })
}

/** Import many scopes sequentially (each scope is its own transaction). */
export const importElectionBundles = async (
  payload: Payload,
  bundles: readonly ElectionImportBundle[],
): Promise<ElectionImportCounts[]> => {
  const results: ElectionImportCounts[] = []
  for (const bundle of bundles) {
    results.push(await importElectionScope(payload, bundle))
  }
  return results
}

/**
 * Build import bundles from flat parsed arrays, grouping by (year, office, turn).
 * Candidates without matching vote/tally scopes are still imported under their own scope.
 */
export const buildImportBundles = (args: {
  votes: readonly CandidateVoteRow[]
  tallies: readonly TseDetalheApuracaoRow[]
  candidates: readonly ElectionCandidateRow[]
}): ElectionImportBundle[] => {
  const votesByScope = groupByScope(args.votes)
  const talliesByScope = groupByScope(args.tallies)
  const candidatesByScope = groupByScope(args.candidates)

  const keys = new Set([
    ...votesByScope.keys(),
    ...talliesByScope.keys(),
    ...candidatesByScope.keys(),
  ])

  return [...keys].map((key) => {
    const sample =
      votesByScope.get(key)?.[0] ??
      talliesByScope.get(key)?.[0] ??
      candidatesByScope.get(key)?.[0]
    if (!sample) {
      throw new Error(`Empty election import scope key: ${key}`)
    }
    return {
      scope: {
        year: sample.year,
        office: sample.office,
        turn: sample.turn,
      },
      votes: votesByScope.get(key) ?? [],
      tallies: talliesByScope.get(key) ?? [],
      candidates: candidatesByScope.get(key) ?? [],
    }
  })
}
