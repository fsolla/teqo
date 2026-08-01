import { describe, expect, it } from 'vitest'

import { CAMPAIGN_CONCEPTS_PATH } from '@/lib/campaignIntelligenceConcepts'
import { CAMPAIGN_PROFILE_HOME } from '@/lib/campaignPaths'
import {
  isConceptsPath,
  isProfilePath,
  isReferenceQuickActionPath,
  resolveReferenceQuickActionsForPath,
} from '@/lib/campaignReferenceQuickActions'

describe('campaignReferenceQuickActions paths', () => {
  it('matches conceitos exactly', () => {
    expect(isConceptsPath(CAMPAIGN_CONCEPTS_PATH)).toBe(true)
    expect(isConceptsPath(`${CAMPAIGN_CONCEPTS_PATH}/`)).toBe(true)
    expect(isConceptsPath(`${CAMPAIGN_CONCEPTS_PATH}/foo`)).toBe(false)
  })

  it('matches perfil exactly', () => {
    expect(isProfilePath(CAMPAIGN_PROFILE_HOME)).toBe(true)
    expect(isProfilePath(`${CAMPAIGN_PROFILE_HOME}/`)).toBe(true)
    expect(isProfilePath(`${CAMPAIGN_PROFILE_HOME}/editar`)).toBe(false)
  })

  it('groups reference surfaces', () => {
    expect(isReferenceQuickActionPath(CAMPAIGN_CONCEPTS_PATH)).toBe(true)
    expect(isReferenceQuickActionPath(CAMPAIGN_PROFILE_HOME)).toBe(true)
    expect(isReferenceQuickActionPath('/campanha/municipios')).toBe(false)
  })
})

describe('resolveReferenceQuickActionsForPath (B90)', () => {
  it('returns empty catalog for staff on conceitos and perfil', () => {
    expect(resolveReferenceQuickActionsForPath(CAMPAIGN_CONCEPTS_PATH, 'coordinator', {})).toEqual(
      [],
    )
    expect(resolveReferenceQuickActionsForPath(CAMPAIGN_PROFILE_HOME, 'advisor', {})).toEqual([])
  })

  it('returns empty catalog for leader lockdown', () => {
    expect(resolveReferenceQuickActionsForPath(CAMPAIGN_PROFILE_HOME, 'leader', {})).toEqual([])
  })
})
