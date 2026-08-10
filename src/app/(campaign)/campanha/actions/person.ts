'use server'

import {
  PERSON_DELETE_FORBIDDEN_MESSAGE,
  personDeleteInputSchema,
} from '@/lib/schemas/personDelete'
import {
  getCampaignActionContext,
  reloadUnrestrictedActor,
} from '@/utilities/campaignActionContext'
import { deletePersonRecord, loadPersonDeleteManifest } from '@/utilities/people/personDelete'

/**
 * C100 "Apagar pessoa" server actions. Both are coordinator/candidate-only
 * (`reloadUnrestrictedActor`): the cascade is transversal, wider than any
 * advisor carteira.
 */

/** The confirmation dialog lists this verbatim before offering the destroy. */
export const getPersonDeleteManifestAction = async (input: unknown) => {
  const data = personDeleteInputSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  await reloadUnrestrictedActor(payload, actor, PERSON_DELETE_FORBIDDEN_MESSAGE)
  return loadPersonDeleteManifest(payload, data.contactId)
}

export const deletePersonAction = async (input: unknown) => {
  const data = personDeleteInputSchema.parse(input)
  const { payload, actor } = await getCampaignActionContext()
  const currentActor = await reloadUnrestrictedActor(
    payload,
    actor,
    PERSON_DELETE_FORBIDDEN_MESSAGE,
  )
  return deletePersonRecord(payload, currentActor, data.contactId)
}
