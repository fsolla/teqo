import { NextResponse } from 'next/server'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { setMunicipalityPoliticalTrend } from '@/app/(campaign)/campanha/actions/municipality'
import { municipalityPoliticalTrendSchema } from '@/lib/schemas/municipality'
import { positiveRelationshipId } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'

import type { MunicipalityListPoliticalTrendResponse } from './types'

export type { MunicipalityListPoliticalTrendResponse } from './types'

export const dynamic = 'force-dynamic'

/** JSON body uses `municipalityId`; the action schema uses `municipality`. */
const bodySchema = municipalityPoliticalTrendSchema
  .omit({ municipality: true })
  .extend({ municipalityId: positiveRelationshipId })

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage: 'Não foi possível salvar a tendência. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, status, note }) => {
    const updated = await setMunicipalityPoliticalTrend({
      municipality: municipalityId,
      status,
      note,
    })

    return NextResponse.json<MunicipalityListPoliticalTrendResponse>({
      status: 'success',
      message: 'Tendência política registrada.',
      savedTrend: {
        status: updated.politicalTrend?.status ?? null,
        note: updated.politicalTrend?.note ?? null,
      },
    })
  },
)
