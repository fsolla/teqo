'use server'

import type { Payload } from 'payload'
import { z } from 'zod'

import type { CampaignUser } from '@/payload-types'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import { eligibleNucleusCoordinatorWhere } from '@/utilities/nucleusCoordinatorOptions'
import { acquireNucleusRowLocks } from '@/utilities/nucleusRowLocks'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const coordinatorAssignmentSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  coordinatorIds: z
    .array(z.number().int().positive())
    .max(100)
    .transform((ids) => [...new Set(ids)]),
  expectedUpdatedAt: z.iso.datetime(),
})

export type CoordinatorAssignmentInput = z.infer<typeof coordinatorAssignmentSchema>

export const assignNucleusCoordinatorsRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: CoordinatorAssignmentInput,
) => {
  const data = coordinatorAssignmentSchema.parse(input)
  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      if (currentActor.role !== 'geral') {
        throw new Error('Somente a coordenação geral pode alterar coordenadores.')
      }

      const scopedResult = await payload.find({
        collection: 'electoralNucleus',
        where: { slug: { equals: data.slug } },
        depth: 0,
        limit: 1,
        pagination: false,
        select: { updatedAt: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      const scopedNucleus = scopedResult.docs[0]
      if (!scopedNucleus) {
        throw new Error('Núcleo não encontrado ou sem acesso.')
      }

      await acquireTextAdvisoryLocks(payload, req, [
        `coordinator-assignment:${scopedNucleus.id}`,
      ])
      await acquireNucleusRowLocks({ payload, ...req } as never, [scopedNucleus.id])

      // Intentional admin bypass: the actor is freshly confirmed as geral and the scoped nucleus
      // is locked before revision, eligibility, and assignment checks.
      const currentNucleus = await payload.findByID({
        collection: 'electoralNucleus',
        id: scopedNucleus.id,
        depth: 0,
        select: { updatedAt: true },
        overrideAccess: true,
        req,
      })
      if (currentNucleus.updatedAt !== data.expectedUpdatedAt) {
        throw new Error(
          'A coordenação deste núcleo foi alterada. Atualize a página e tente novamente.',
        )
      }

      if (data.coordinatorIds.length > 0) {
        const eligible = await payload.find({
          collection: 'campaignUser',
          where: {
            and: [{ id: { in: data.coordinatorIds } }, eligibleNucleusCoordinatorWhere],
          },
          depth: 0,
          pagination: false,
          select: { name: true },
          overrideAccess: true,
          req,
        })
        if (eligible.docs.length !== data.coordinatorIds.length) {
          throw new Error(
            'Uma ou mais pessoas selecionadas não são mais elegíveis para coordenação.',
          )
        }
      }

      return payload.update({
        collection: 'electoralNucleus',
        id: currentNucleus.id,
        data: { coordinators: data.coordinatorIds },
        depth: 0,
        overrideAccess: true,
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível iniciar a transação da designação.' },
  )
}

export const assignNucleusCoordinators = async (input: CoordinatorAssignmentInput) => {
  const { payload, actor } = await getCampaignActionContext()
  return assignNucleusCoordinatorsRecord(payload, actor, input)
}
