import { NextResponse } from 'next/server'
import { z } from 'zod'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { updateMunicipalityStrategy } from '@/app/(campaign)/campanha/actions/municipality'
import { positiveRelationshipId, trimmedNullableText } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'

import type { MunicipalityNextStepsResponse } from './types'

export type { MunicipalityNextStepsResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  nextSteps: trimmedNullableText(4000),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage:
      'Não foi possível salvar o encaminhamento. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, nextSteps }) => {
    const updated = await updateMunicipalityStrategy({
      municipality: municipalityId,
      nextSteps,
    })

    revalidateMunicipalityListPaths({ slug: updated.slug, scope: 'detail' })

    return NextResponse.json<MunicipalityNextStepsResponse>({
      status: 'success',
      message: 'Encaminhamento atualizado.',
      savedNextSteps: updated.nextSteps ?? null,
    })
  },
)
