'use server'

import { createCampaignDemand } from '@/app/(campaign)/campanha/actions/demand'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { parseCampaignDemandCreateFormData } from '@/utilities/demand/campaignDemandFormData'

export const createDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: () => createCampaignDemand(parseCampaignDemandCreateFormData(formData)),
    redirectTo: (demand) => `/campanha/demandas/${demand.slug}`,
    genericMessage: 'Não foi possível abrir a demanda. Verifique os dados e tente novamente.',
  })
