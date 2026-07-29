// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildSupporterSearchTerms,
  toPayloadWhere,
} from '@/utilities/supporter/supporterListFilters'
import { toAggregateSqlConditions } from '@/utilities/supporter/supporterListSqlFilters'

describe('supporterListFilters', () => {
  it('ignores search terms shorter than the contact search minimum', () => {
    expect(buildSupporterSearchTerms('a')).toBeNull()
    expect(toPayloadWhere({ q: 'a' })).toEqual({})
    expect(toAggregateSqlConditions({ q: 'a' }).needsContactJoin).toBe(false)
  })

  it('builds matching payload and SQL search conditions for text queries', () => {
    const state = { q: 'ana' }
    const payloadWhere = toPayloadWhere(state)
    const aggregate = toAggregateSqlConditions(state)

    expect(payloadWhere).toEqual({
      and: [
        {
          or: [{ 'contact.name': { contains: 'ana' } }, { 'contact.city': { contains: 'ana' } }],
        },
      ],
    })
    expect(aggregate.needsContactJoin).toBe(true)
    expect(aggregate.conditions).toHaveLength(1)
  })

  it('normalizes phone search terms consistently', () => {
    const terms = buildSupporterSearchTerms('(71) 98888-7777')
    expect(terms).toEqual({
      q: '(71) 98888-7777',
      normalizedPhone: '71988887777',
      phoneDigits: null,
    })

    const payloadWhere = toPayloadWhere({ q: '(71) 98888-7777' })
    expect(payloadWhere).toEqual({
      and: [
        {
          or: [
            { 'contact.name': { contains: '(71) 98888-7777' } },
            { 'contact.city': { contains: '(71) 98888-7777' } },
            { 'contact.phone': { equals: '71988887777' } },
          ],
        },
      ],
    })
  })

  it('applies vote intention, city, and municipality filters in both adapters', () => {
    const state = {
      page: 1,
      voteIntention: 'indeciso' as const,
      city: 'Salvador',
      municipality: 42,
    }

    expect(toPayloadWhere(state)).toEqual({
      and: [
        { voteIntention: { equals: 'indeciso' } },
        { 'contact.city': { equals: 'Salvador' } },
        { municipality: { equals: 42 } },
      ],
    })

    const aggregate = toAggregateSqlConditions(state)
    expect(aggregate.needsContactJoin).toBe(true)
    expect(aggregate.conditions).toHaveLength(3)
  })
})
