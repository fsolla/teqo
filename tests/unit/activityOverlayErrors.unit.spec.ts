import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_DEMAND_DUPLICATE_MESSAGE,
  ACTIVITY_DUPLICATE_TITLE_MESSAGE,
  ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE,
} from '@/lib/activityOverlayMessages'
import { FormDataBoundaryError } from '@/lib/formData'
import { mapActivityOverlayError } from '@/utilities/activityOverlayErrors'

describe('activity overlay error mapping', () => {
  it('surfaces a DB unique-title violation as a title field error', () => {
    expect(
      mapActivityOverlayError(
        new Error('duplicate key value violates unique constraint "activity_slug_unique"'),
      ),
    ).toEqual({
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    })
    expect(mapActivityOverlayError(new Error('já existe uma atividade'))).toEqual({
      message: ACTIVITY_DUPLICATE_TITLE_MESSAGE,
      fieldErrors: { title: [ACTIVITY_DUPLICATE_TITLE_MESSAGE] },
    })
  })

  it('surfaces a DB unique-violation of a linked demand as a demandsJson field error', () => {
    expect(
      mapActivityOverlayError(
        new Error('duplicate key value violates unique constraint "campaign_demand_slug_unique"'),
      ),
    ).toEqual({
      message: ACTIVITY_DEMAND_DUPLICATE_MESSAGE,
      fieldErrors: { demandsJson: [ACTIVITY_DEMAND_DUPLICATE_MESSAGE] },
    })
  })

  it('maps FormDataBoundaryError to the named field', () => {
    expect(mapActivityOverlayError(new FormDataBoundaryError('startAt', 'Data inválida.'))).toEqual(
      {
        message: ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE,
        fieldErrors: { startAt: ['Data inválida.'] },
      },
    )
  })

  it('collapses every other failure to the generic message', () => {
    const generic = { message: ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE }
    expect(mapActivityOverlayError(new Error('Boom'))).toEqual(generic)
    expect(mapActivityOverlayError('string')).toEqual(generic)
    expect(mapActivityOverlayError(undefined)).toEqual(generic)
  })
})
