import 'server-only'

import type { Payload } from 'payload'

export type DrizzleTables = Record<string, Record<string, unknown>>

type PayloadDbTables = {
  tables: DrizzleTables
}

/** ~15-16 columns × 500 ≈ 7500-8000 bind params — well under PG's 65535 param limit. */
export const INSERT_CHUNK_SIZE = 500

export const chunk = <T>(rows: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

export const getDrizzleTables = (payload: Pick<Payload, 'db'>): DrizzleTables =>
  (payload.db as unknown as PayloadDbTables).tables

export const requireTable = (
  tables: DrizzleTables,
  name: string,
): Record<string, unknown> => {
  const table = tables[name]
  if (!table) throw new Error(`Tabela drizzle ausente: ${name}. Rode as migrations.`)
  return table
}

/**
 * Fails fast when a drizzle table's JS-level column scaffold has drifted from
 * what a bulk insert assumes (e.g. `contactId` vs `contact`) — catches the bug
 * class before a silent bad insert instead of a runtime SQL error mid-import.
 */
export const assertDrizzleColumns = (
  table: Record<string, unknown>,
  tableName: string,
  expectedColumns: readonly string[],
): void => {
  const missing = expectedColumns.filter((column) => !(column in table))
  if (missing.length > 0) {
    throw new Error(
      `Tabela drizzle "${tableName}" não tem as colunas esperadas: ${missing.join(', ')}. ` +
        'O bulk insert usaria nomes de coluna divergentes do schema atual.',
    )
  }
}

/** Normalizes a drizzle `execute()` result (bare array vs `{ rows }`) into row objects. */
export const drizzleResultRows = (result: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}
