import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_DUPLICATE_TITLE_MESSAGE,
  ACTIVITY_INLINE_GENERIC_FAILURE_MESSAGE,
  mapActivityInlineCreateError,
} from '@/utilities/activityInlineErrors'

describe('activity inline create error mapping', () => {
  it('surfaces a DB unique-title violation as a title field error', () => {
    expect(
      mapActivityInlineCreateError(
        new Error('duplicate key value violates unique constraint "activity_slug_unique"'),
      ),
    ).toEqual({
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    })
    expect(mapActivityInlineCreateError(new Error('já existe uma atividade'))).toEqual({
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    })
  })

  it('collapses every other failure to the generic message', () => {
    const generic = { message: ACTIVITY_INLINE_GENERIC_FAILURE_MESSAGE }
    expect(mapActivityInlineCreateError(new Error('Boom'))).toEqual(generic)
    expect(mapActivityInlineCreateError('string')).toEqual(generic)
    expect(mapActivityInlineCreateError(undefined)).toEqual(generic)
  })
})
