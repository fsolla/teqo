// @vitest-environment node

import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import type { CampaignUser } from '@/payload-types'
import { buildAITools } from '@/utilities/ai/tools'

import { stub } from '../helpers/stub'

// C159 — the communication assessor's chat is scoped to the speech acervo by
// construction: the campaign tools never reach the model, so an out-of-scope
// question cannot become a forbidden query or a leaked number. The scoped set
// is the acervo tool plus the minimum (math and the links she can reach).
const SCOPED_TOOLS = ['calculate', 'buildCampaignLinks', 'findSpeechExcerpts']

const CAMPAIGN_TOOLS = [
  'getMunicipalityVotes',
  'getTopDeputies',
  'getLeadingMunicipalities',
  'getDobradinhas',
  'getMunicipalitiesWithoutUpdate',
  'getMunicipalityOverview',
  'getMunicipalityPriorities',
  'getLeaderships',
  'getPendingLeaderships',
  'getOrganizations',
  'getPartnershipCoverage',
  'searchEntities',
]

const ctxFor = (role: CampaignUser['role']) => ({
  user: stub<CampaignUser>({ role }),
  payload: stub<Payload>({}),
})

describe('buildAITools role scope (C159)', () => {
  it('gives the communication assessor only the acervo toolset', () => {
    const tools = buildAITools(ctxFor('communicator'))
    expect(Object.keys(tools).sort()).toEqual([...SCOPED_TOOLS].sort())
  })

  it('falls back to the acervo toolset for an unknown role (fail-closed)', () => {
    const tools = buildAITools(ctxFor('desconhecido' as CampaignUser['role']))
    expect(Object.keys(tools).sort()).toEqual([...SCOPED_TOOLS].sort())
  })

  it('keeps the full toolset for staff and the leader (lockdown untouched)', () => {
    for (const role of ['coordinator', 'advisor', 'candidate', 'leader'] as const) {
      const keys = Object.keys(buildAITools(ctxFor(role)))
      expect(keys).toHaveLength(SCOPED_TOOLS.length + CAMPAIGN_TOOLS.length)
      for (const toolName of [...SCOPED_TOOLS, ...CAMPAIGN_TOOLS]) {
        expect(keys).toContain(toolName)
      }
    }
  })
})
