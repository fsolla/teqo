'use server'

import { createCampaignDemand } from '@/app/(campaign)/campanha/actions/demand'
import { optionalFormText, requiredFormText, requiredRelationshipFormValue } from '@/lib/formData'
import { campaignDemandKinds, type CampaignDemandKind } from '@/lib/schemas/campaignDemand'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: () => {
      const rawKind = requiredFormText(formData, 'kind')
      return createCampaignDemand({
        title: requiredFormText(formData, 'title'),
        kind: campaignDemandKinds.includes(rawKind as CampaignDemandKind)
          ? (rawKind as CampaignDemandKind)
          : 'outro',
        description: optionalFormText(formData, 'description'),
        municipality: requiredRelationshipFormValue(formData, 'municipalityId'),
      })
    },
    redirectTo: (demand) => `/campanha/demandas/${demand.slug}`,
    safeMessages: ['Somente a coordenação e a assessoria podem abrir demandas.'],
    genericMessage: 'Não foi possível abrir a demanda. Verifique os dados e tente novamente.',
  })
