'use server'

import { createCampaignDemand } from '@/app/(campaign)/campanha/actions/demand'
import { WIZARD_DEMAND_SAVED_MESSAGE } from '@/lib/campaignWizardCopy'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { parseCampaignDemandCreateFormData } from '@/utilities/demand/campaignDemandFormData'

/**
 * Stay-on-page form action for the register-demand wizard step (B195): same
 * create path as `/demandas/nova`, but the wizard owns the success toast and
 * the return navigation (`returnPath`), so there is no redirect here.
 */
export const createWizardDemandFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await createCampaignDemand(parseCampaignDemandCreateFormData(formData))
      return { message: WIZARD_DEMAND_SAVED_MESSAGE }
    },
    genericMessage: 'Não foi possível abrir a demanda. Verifique os dados e tente novamente.',
  })
