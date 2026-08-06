import { describe, expect, it } from 'vitest'

import { ACTIVITY_LINKED_DEMANDS_PAGE_SIZE } from '@/utilities/activityDetailPageData'
import { ACTIVITY_RELATION_SEARCH_LIMIT } from '@/utilities/activityRelationOptions'
import { parseDemandListParams } from '@/utilities/campaignDemandData'

describe('activityRelationOptions', () => {
  it('caps search results at the configured limit', () => {
    expect(ACTIVITY_RELATION_SEARCH_LIMIT).toBe(20)
  })
})

describe('activity linked demands scale (C11)', () => {
  it('uses a bounded page size for overview cards', () => {
    expect(ACTIVITY_LINKED_DEMANDS_PAGE_SIZE).toBe(10)
  })

  it('parses activity filter on the demand list', () => {
    expect(parseDemandListParams({ activity: '42', page: '2' })).toEqual({
      activityId: 42,
    })
  })
})
