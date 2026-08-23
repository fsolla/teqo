'use server'

import { revalidatePath } from 'next/cache'
import type { Payload } from 'payload'

import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import {
  MUNICIPALITY_UPDATE_NO_MUNICIPALITY_MESSAGE,
  MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE,
  municipalityUpdateCommentSchema,
  municipalityUpdateResolveSchema,
  municipalityUpdateResponsibleSchema,
  type MunicipalityUpdateCommentInput,
  type MunicipalityUpdateResponsibleInput,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser } from '@/payload-types'
import { assignableUpdateStaffWhere } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadCampaignActor } from '@/utilities/campaignActionContext'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const deliberationLock = (updateId: number) => [`municipality-update:${updateId}`]

/**
 * C88 — the assignee must be staff who already sees the territory: an advisor
 * of the municipality or coordinator/candidate (unrestricted). The check reuses
 * the exact `campaignUser` where the feed loader offers in the select
 * (`assignableUpdateStaffWhere`), so the UI options and the save validation
 * can never drift. Leaders are never assignable.
 */
const assertAssignableResponsible = async (
  payload: Payload,
  actor: CampaignUser,
  req: { transactionID: number | string },
  municipalityID: number,
  responsibleId: number,
): Promise<void> => {
  const municipality = await payload.findByID({
    collection: 'municipality',
    id: municipalityID,
    depth: 0,
    select: { advisors: true },
    user: actor,
    overrideAccess: false,
    req,
  })
  const advisorIDs = uniqueRelationshipIds(municipality.advisors)

  const found = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [{ id: { equals: responsibleId } }, assignableUpdateStaffWhere(advisorIDs)],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
    req,
  })
  if (found.docs.length === 0) throw new Error(MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE)
}

export const assignMunicipalityUpdateResponsibleRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityUpdateResponsibleInput,
) => {
  const { updateId, responsibleId } = municipalityUpdateResponsibleSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, deliberationLock(updateId))

      const update = await payload.findByID({
        collection: 'municipalityUpdate',
        id: updateId,
        depth: 0,
        select: { municipality: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })
      const municipalityID = relationshipId(update.municipality)
      if (municipalityID === null) {
        throw new Error(MUNICIPALITY_UPDATE_NO_MUNICIPALITY_MESSAGE)
      }
      if (responsibleId !== null) {
        await assertAssignableResponsible(payload, currentActor, req, municipalityID, responsibleId)
      }

      return payload.update({
        collection: 'municipalityUpdate',
        id: updateId,
        data: { responsible: responsibleId },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'assignResponsible' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível definir o responsável da atualização.' },
  )
}

export const addMunicipalityUpdateCommentRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: MunicipalityUpdateCommentInput,
) => {
  const { updateId, body } = municipalityUpdateCommentSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, deliberationLock(updateId))

      const update = await payload.findByID({
        collection: 'municipalityUpdate',
        id: updateId,
        depth: 0,
        select: { comments: true },
        user: currentActor,
        overrideAccess: false,
        req,
      })

      const comments = update.comments ?? []
      return payload.update({
        collection: 'municipalityUpdate',
        id: updateId,
        data: { comments: [...comments, { body }] },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: 'appendComment' },
        req,
      })
    },
    { beginFailureMessage: 'Não foi possível registrar o comentário.' },
  )
}

const setMunicipalityUpdateResolvedRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: { updateId: number },
  resolved: boolean,
) => {
  const { updateId } = municipalityUpdateResolveSchema.parse(input)

  return withPayloadTransaction(
    payload,
    async ({ req }) => {
      const currentActor = await reloadCampaignActor(payload, actor, req)
      await acquireTextAdvisoryLocks(payload, req, deliberationLock(updateId))

      // The hook owns the audit trail: it stamps `resolvedBy` from the acting
      // user and `resolvedAt` from the server clock — the action only signals
      // the transition.
      return payload.update({
        collection: 'municipalityUpdate',
        id: updateId,
        data: resolved ? { resolvedAt: new Date().toISOString() } : { resolvedAt: null },
        depth: 0,
        user: currentActor,
        overrideAccess: false,
        context: { mutationKind: resolved ? 'resolve' : 'reopen' },
        req,
      })
    },
    {
      beginFailureMessage: resolved
        ? 'Não foi possível marcar a atualização como resolvida.'
        : 'Não foi possível reabrir a atualização.',
    },
  )
}

export const markMunicipalityUpdateResolvedRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: { updateId: number },
) => setMunicipalityUpdateResolvedRecord(payload, actor, input, true)

export const markMunicipalityUpdateReopenedRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: { updateId: number },
) => setMunicipalityUpdateResolvedRecord(payload, actor, input, false)

const revalidateDeliberationSurfaces = (): void => {
  revalidatePath('/campanha/municipios/[slug]', 'page')
  revalidatePath('/campanha/atualizacoes')
}

export const assignUpdateResponsibleFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const updateId = Number(formData.get('updateId'))
      const rawResponsible = formData.get('responsibleId')
      const { payload, actor } = await getCampaignActionContext()
      await assignMunicipalityUpdateResponsibleRecord(payload, actor, {
        updateId,
        responsibleId: rawResponsible ? Number(rawResponsible) : null,
      })
      revalidateDeliberationSurfaces()
      return { message: 'Responsável definido.' }
    },
    genericMessage: 'Não foi possível definir o responsável. Verifique o usuário e seu acesso.',
    safeMessages: [MUNICIPALITY_UPDATE_RESPONSIBLE_NOT_ELIGIBLE_MESSAGE],
  })

export const addUpdateCommentFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const { payload, actor } = await getCampaignActionContext()
      await addMunicipalityUpdateCommentRecord(payload, actor, {
        updateId: Number(formData.get('updateId')),
        body: String(formData.get('body') ?? ''),
      })
      revalidateDeliberationSurfaces()
      return { message: 'Comentário registrado.' }
    },
    genericMessage: 'Não foi possível registrar o comentário. Verifique seu acesso.',
  })

export const markUpdateResolvedFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const { payload, actor } = await getCampaignActionContext()
      await markMunicipalityUpdateResolvedRecord(payload, actor, {
        updateId: Number(formData.get('updateId')),
      })
      revalidateDeliberationSurfaces()
      return { message: 'Atualização marcada como resolvida.' }
    },
    genericMessage: 'Não foi possível marcar a atualização como resolvida.',
  })

export const markUpdateReopenedFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const { payload, actor } = await getCampaignActionContext()
      await markMunicipalityUpdateReopenedRecord(payload, actor, {
        updateId: Number(formData.get('updateId')),
      })
      revalidateDeliberationSurfaces()
      return { message: 'Atualização reaberta.' }
    },
    genericMessage: 'Não foi possível reabrir a atualização.',
  })
