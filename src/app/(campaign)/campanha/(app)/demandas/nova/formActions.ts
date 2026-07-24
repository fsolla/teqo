'use server'

import { redirect } from 'next/navigation'

import { createCampaignDemand } from '@/app/(campaign)/campanha/actions/demand'
import { optionalFormText, requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import { campaignDemandKinds, type CampaignDemandKind } from '@/lib/schemas/campaignDemand'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  let createdSlug: string | null = null
  try {
    const rawKind = requiredFormText(formData, 'kind')
    const demand = await createCampaignDemand({
      title: requiredFormText(formData, 'title'),
      kind: campaignDemandKinds.includes(rawKind as CampaignDemandKind)
        ? (rawKind as CampaignDemandKind)
        : 'outro',
      description: optionalFormText(formData, 'description'),
      municipality: requiredRelationshipFormValue(formData, 'municipalityId'),
    })
    createdSlug = demand.slug
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria podem abrir demandas.'],
      genericMessage: 'Não foi possível abrir a demanda. Verifique os dados e tente novamente.',
    })
  }

  redirect(`/campanha/demandas/${createdSlug}`)
}
