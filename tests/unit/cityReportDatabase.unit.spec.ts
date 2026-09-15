import { describe, expect, it } from 'vitest'

import { databaseLabel, withReadOnlyDatabaseUrl } from '../../scripts/lib/cityReportDatabase.mjs'

describe('cityReportDatabase', () => {
  it('appends the read-only session options to the URL', () => {
    const url = withReadOnlyDatabaseUrl('postgresql://teqo:senha@127.0.0.1:5433/teqo_1313')
    expect(url).toContain('options=')
    expect(decodeURIComponent(url)).toContain('default_transaction_read_only=on')
    expect(decodeURIComponent(url)).toContain('statement_timeout=30000')
  })

  it('preserves pre-existing options instead of overwriting them', () => {
    const url = withReadOnlyDatabaseUrl(
      'postgresql://teqo:senha@127.0.0.1:5433/teqo_1313?options=-c%20search_path%3Dpublic',
    )
    const decoded = decodeURIComponent(new URL(url).searchParams.get('options') ?? '')
    expect(decoded).toContain('search_path=public')
    expect(decoded).toContain('default_transaction_read_only=on')
  })

  it('fails closed without a database url', () => {
    expect(() => withReadOnlyDatabaseUrl('')).toThrow(/DATABASE_URL/)
    expect(() => withReadOnlyDatabaseUrl('não é url')).toThrow(/inválida/)
  })

  it('labels the database without credentials', () => {
    expect(databaseLabel('postgresql://teqo:senha@127.0.0.1:5433/teqo_1313')).toBe(
      '127.0.0.1:5433/teqo_1313',
    )
  })
})
