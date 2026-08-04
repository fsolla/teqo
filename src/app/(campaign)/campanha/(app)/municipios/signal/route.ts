import { NextResponse } from 'next/server'
import { z } from 'zod'

import { municipalityStaffEditSafeMessages } from '@/app/(campaign)/campanha/(app)/municipios/municipalityStaffEditMessages'
import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import { municipalitySignalTypes } from '@/lib/schemas/municipalityUpdate'
import { positiveRelationshipId, trimmedOptionalText } from '@/lib/schemas/primitives'
import { campaignJsonMutationRoute } from '@/utilities/campaignJsonMutationRoute'
import { revalidateMunicipalityListPaths } from '@/utilities/municipality/municipalityRevalidation'

import type { MunicipalityListSignalResponse } from './types'

export type { MunicipalityListSignalResponse } from './types'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipalityId: positiveRelationshipId,
  body: trimmedOptionalText(5000).optional(),
  signalType: z.enum(municipalitySignalTypes).optional(),
})

export const POST = campaignJsonMutationRoute(
  {
    bodySchema,
    safeMessages: municipalityStaffEditSafeMessages,
    genericMessage: 'Não foi possível registrar o sinal. Verifique seu acesso e tente novamente.',
  },
  async ({ municipalityId, body, signalType }) => {
    await createMunicipalityUpdate({
      municipality: municipalityId,
      kind: 'sinal',
      body: body ?? undefined,
      signalType,
    })

    revalidateMunicipalityListPaths({})

    return NextResponse.json<MunicipalityListSignalResponse>({
      status: 'success',
      message: 'Sinal registrado.',
    })
  },
)
