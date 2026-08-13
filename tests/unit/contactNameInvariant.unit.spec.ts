import { describe, expect, it, vi } from 'vitest'

import type { Payload } from 'payload'

import { CONTACT_NAME_CONFLICT_MESSAGE } from '@/lib/schemas/contact'
import {
  assertContactNameAvailable,
  normalizeContactName,
} from '@/utilities/contacts/contactNameInvariant'

describe('normalizeContactName', () => {
  it('trims, collapses internal whitespace and lowercases', () => {
    expect(normalizeContactName('  Maria  da  Silva ')).toBe('maria da silva')
    expect(normalizeContactName('João')).toBe('joão')
    expect(normalizeContactName('')).toBe('')
  })
})

describe('assertContactNameAvailable', () => {
  type WhereClause = {
    and?: { name?: { like?: string }; id?: { not_equals?: number } }[]
  }
  const makePayload = (docs: { name: string; id?: number }[]): Pick<Payload, 'db' | 'find'> => ({
    db: {
      name: 'postgres',
      sessions: { tx: { db: { execute: vi.fn() } } },
    } as unknown as Payload['db'],
    find: vi.fn().mockImplementation(async ({ where }: { where?: WhereClause }) => {
      const conditions = where?.and ?? []
      const idExclusion = conditions.find((c) => c.id?.not_equals)?.id?.not_equals
      const like = conditions.find((c) => c.name?.like)?.name?.like
      const filtered = docs.filter((doc) => {
        if (idExclusion !== undefined && doc.id === idExclusion) return false
        if (like && !doc.name.toLowerCase().includes(like)) return false
        return true
      })
      return { docs: filtered, totalDocs: filtered.length }
    }) as unknown as Payload['find'],
  })

  it('passes when no stored contact normalizes to the same name', async () => {
    const payload = makePayload([{ id: 9, name: 'Maria Souza' }])
    await expect(
      assertContactNameAvailable(payload, { transactionID: 'tx' }, '  maria  silva '),
    ).resolves.toBeUndefined()
    // The DB prefilter runs the case-insensitive substring, the verdict is in memory.
    expect(payload.find).toHaveBeenCalledOnce()
  })

  it('throws the conflict message on a normalized-name match (case/whitespace insensitive)', async () => {
    const payload = makePayload([{ id: 9, name: 'Maria Silva' }])
    await expect(assertContactNameAvailable(payload, {}, 'MARIA   SILVA')).rejects.toThrow(
      CONTACT_NAME_CONFLICT_MESSAGE,
    )
  })

  it('ignores the contact itself when renaming (contactID excluded)', async () => {
    const payload = makePayload([{ id: 9, name: 'Maria Silva' }])
    await expect(assertContactNameAvailable(payload, {}, 'Maria Silva', 9)).resolves.toBeUndefined()
  })

  it('does not collide on a partial-name substring match', async () => {
    const payload = makePayload([{ id: 9, name: 'Ana Maria' }])
    await expect(assertContactNameAvailable(payload, {}, 'Maria')).resolves.toBeUndefined()
  })
})
