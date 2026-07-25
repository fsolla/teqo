import 'server-only'

import { and, eq, type AnyColumn } from '@payloadcms/db-postgres/drizzle'
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
import { chunk, getDrizzleTables, INSERT_CHUNK_SIZE, requireTable } from '@/utilities/drizzleBulk'

const VOTE_TABLE = 'election_candidate_vote'
const TALLY_TABLE = 'election_tally'
const CANDIDATE_TABLE = 'election_candidate'

type ElectionImportScope = {
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

type PayloadDbDrizzle = {
  drizzle: {
    transaction: <T>(fn: (tx: DrizzleTx) => Promise<T>) => Promise<T>
  }
}

/** Payload's generated Drizzle tables type columns as `unknown` — narrow with a runtime check. */
const scopeColumn = (
  table: Record<string, unknown>,
  name: 'year' | 'office' | 'turn',
): AnyColumn => {
  const column = table[name]
  if (column == null) throw new Error(`Election table is missing the "${name}" column.`)
  return column as AnyColumn
}

const scopeWhere = (table: Record<string, unknown>, scope: ElectionImportScope) =>
  and(
    eq(scopeColumn(table, 'year'), scope.year),
    eq(scopeColumn(table, 'office'), scope.office),
    eq(scopeColumn(table, 'turn'), scope.turn),
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
const importElectionScope = async (
  payload: Payload,
  bundle: ElectionImportBundle,
): Promise<ElectionImportCounts> => {
  const tables = getDrizzleTables(payload)
  const voteTable = requireTable(tables, VOTE_TABLE)
  const tallyTable = requireTable(tables, TALLY_TABLE)
  const candidateTable = requireTable(tables, CANDIDATE_TABLE)
  const dbAdapter = payload.db as unknown as PayloadDbDrizzle

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
        await tx
          .insert(tallyTable)
          .values(batch.map((row: ElectionTallyRow) => withTimestamps(row, now)))
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
      votesByScope.get(key)?.[0] ?? talliesByScope.get(key)?.[0] ?? candidatesByScope.get(key)?.[0]
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
