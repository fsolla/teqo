import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'
import { electionDataGate } from '@/utilities/ai/tools/electionDataGate'
import { getLeadingMunicipalities } from '@/utilities/ai/tools/getLeadingMunicipalities'
import { getMunicipalityVotes } from '@/utilities/ai/tools/getMunicipalityVotes'
import { getTopDeputies } from '@/utilities/ai/tools/getTopDeputies'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura de dados eleitorais negada.' }

/** A payload whose find throws — any query after a failed gate is a bug. */
const untouchablePayload = stub<Payload>({
  find: () => {
    throw new Error('gate must fail closed before any payload query')
  },
})

const ctxFor = (user: CampaignUser, payload: Payload): AIToolContext => ({ user, payload })

const leader = stub<CampaignUser>({ collection: 'campaignUser', role: 'leader' })
const coordinator = stub<CampaignUser>({ collection: 'campaignUser', role: 'coordinator' })

const emptyDocsPayload = stub<Payload>({
  find: async () => ({
    docs: [],
    hasNextPage: false,
    hasPrevPage: false,
    limit: 0,
    nextPage: null,
    pagingCounter: 0,
    prevPage: null,
    totalDocs: 0,
    totalPages: 0,
  }),
})

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

describe('electionDataGate (B180)', () => {
  it('denies a leader with the chat-shaped error', () => {
    expect(electionDataGate(ctxFor(leader, untouchablePayload))).toEqual(denied)
  })

  it('lets staff pass', () => {
    expect(electionDataGate(ctxFor(coordinator, untouchablePayload))).toBe(true)
  })
})

describe('election tools leader lockdown (B180)', () => {
  it('getTopDeputies fails closed before any payload query', async () => {
    const execute = (
      getTopDeputies(ctxFor(leader, untouchablePayload)) as unknown as ExecutableTool
    ).execute
    expect(execute).toBeTypeOf('function')
    await expect(execute!({ municipality: 'Feira de Santana' })).resolves.toEqual(denied)
  })

  it('getMunicipalityVotes fails closed before any payload query', async () => {
    const execute = (
      getMunicipalityVotes(ctxFor(leader, untouchablePayload)) as unknown as ExecutableTool
    ).execute
    expect(execute).toBeTypeOf('function')
    await expect(execute!({ municipality: 'Feira de Santana' })).resolves.toEqual(denied)
  })

  it('getLeadingMunicipalities fails closed before any payload query', async () => {
    const execute = (
      getLeadingMunicipalities(ctxFor(leader, untouchablePayload)) as unknown as ExecutableTool
    ).execute
    expect(execute).toBeTypeOf('function')
    // A non-campaign candidate forces the SQL/payload path — the default
    // candidate reads the committed artifact and never touches payload.
    await expect(execute!({ candidate: '5000' })).resolves.toEqual(denied)
  })
})

describe('election tools staff behavior unchanged (B180)', () => {
  const staffRoles = ['coordinator', 'advisor', 'candidate'] as const
  const staffUser = (role: (typeof staffRoles)[number]) =>
    stub<CampaignUser>({ collection: 'campaignUser', role })

  for (const role of staffRoles) {
    it(`getTopDeputies still resolves a municipality for ${role}`, async () => {
      const execute = (
        getTopDeputies(ctxFor(staffUser(role), emptyDocsPayload)) as unknown as ExecutableTool
      ).execute
      const result = await execute!({ municipality: 'Feira de Santana' })
      expect(result).toMatchObject({ municipality: 'Feira de Santana', topDeputies: [] })
    })

    it(`getMunicipalityVotes still resolves a municipality for ${role}`, async () => {
      const execute = (
        getMunicipalityVotes(ctxFor(staffUser(role), emptyDocsPayload)) as unknown as ExecutableTool
      ).execute
      const result = await execute!({ municipality: 'Feira de Santana' })
      expect(result).toMatchObject({ municipality: 'Feira de Santana' })
    })
  }
})
