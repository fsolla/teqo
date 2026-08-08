import { describe, expect, it } from 'vitest'

import { assertTestDatabase } from '../helpers/assertTestDatabase'

describe('assertTestDatabase', () => {
  it.each([
    'postgresql://teqo:teqo@localhost:5432/teqo_test',
    'postgresql://teqo:teqo@localhost:5432/teqo_wt15_test',
    'postgresql://teqo:teqo@127.0.0.1:5432/teqo_test',
    'postgresql://teqo:teqo@127.0.0.1:5432/teqo_wt164_test',
    'postgresql://teqo:teqo@[::1]:5432/teqo_test',
  ])('accepts the local test database at %s', (databaseUrl) => {
    expect(() => assertTestDatabase(databaseUrl)).not.toThrow()
  })

  it.each([
    'postgresql://teqo:teqo@localhost:5432/other_test',
    'postgresql://teqo:teqo@localhost:5432/teqo',
    'postgresql://teqo:teqo@localhost:5432/teqo_wt15',
    'postgresql://teqo:teqo@localhost:5432/teqo_test_extra',
    'postgresql://teqo:teqo@localhost:5432/teqo_Test_test',
    'postgresql://teqo:teqo@db.example.com:5432/teqo_test',
    'postgresql://teqo:teqo@neon.example.com:5432/teqo_wt15_test',
    'postgres://teqo:teqo@localhost:5432/teqo_test',
    'https://localhost/teqo_test',
    'postgresql+srv://teqo:teqo@localhost:5432/teqo_test',
    'postgresql://teqo:teqo@localhost:5432/teqo_test/extra',
    'not-a-url',
    undefined,
  ])('rejects unsafe database URL %s', (databaseUrl) => {
    expect(() => assertTestDatabase(databaseUrl)).toThrow()
  })
})
