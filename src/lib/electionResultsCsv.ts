import { parse } from 'csv-parse/sync'

import type { TseCsvRow } from '@/lib/electionResultsParse'

/**
 * Parse a TSE open-data CSV buffer (Latin-1 / ISO-8859-1, `;` separator, quoted fields).
 */
export const parseTseCsvBuffer = (buffer: Buffer): TseCsvRow[] => {
  const text = buffer.toString('latin1')
  return parse(text, {
    columns: true,
    delimiter: ';',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as TseCsvRow[]
}

export const parseTseCsvString = (text: string): TseCsvRow[] =>
  parseTseCsvBuffer(Buffer.from(text, 'utf8'))
