'use server'

import type { Payload } from 'payload'

import { assertOpsUpdatedAtCas } from '@/lib/schemas/opsCas'
import {
  municipalityUpdateCreateSchema,
  type MunicipalityUpdateCreateInput,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { hookFilledCreateData } from '@/utilities/hookFilledData'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

export const createMunicipalityUpdateRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityUpdateCreateInput,
  options?: { cas?: boolean },
) => {
  const data = municipalityUpdateCreateSchema.parse(input)
  const enforceCas = options?.cas === true

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)

      // CAS on parent municipality `updatedAt` (feed order / consistency).
      if (enforceCas && data.baseUpdatedAt !== undefined) {
        const parent = await payload.findByID({
          collection: 'municipality',
          id: data.municipality,
          depth: 0,
          select: { updatedAt: true },
          user: currentActor,
          overrideAccess: false,
          req,
        })
        assertOpsUpdatedAtCas(true, data.baseUpdatedAt, parent.updatedAt)
      }

      const { baseUpdatedAt: _baseUpdatedAt, ...createData } = data

      return payload.create({
        collection: 'municipalityUpdate',
        data: hookFilledCreateData<'municipalityUpdate'>(createData),
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar o registro da atualização.' },
  )
}

export const createMunicipalityUpdate = async (input: MunicipalityUpdateCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createMunicipalityUpdateRecord(payload, actor, input)
}

/** OH10 — create feed update with optional CAS on parent municipality `updatedAt`. */
export const createMunicipalityUpdateCas = async (input: MunicipalityUpdateCreateInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return createMunicipalityUpdateRecord(payload, actor, input, { cas: true })
}

export const createMunicipalityUpdateCasRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityUpdateCreateInput,
) => createMunicipalityUpdateRecord(payload, actor, input, { cas: true })
