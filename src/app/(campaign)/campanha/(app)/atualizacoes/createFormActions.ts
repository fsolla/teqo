'use server'

import { revalidatePath } from 'next/cache'

import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'
import { parseMunicipalityUpdateFormData } from '@/utilities/municipality/municipalityUpdateFormData'

/**
 * C89 feed-page create action: the same unified MunicipalityUpdate writer as
 * the municipality detail form, revalidating only this feed route so the new
 * card surfaces at the top (no full page reload). The actor's access is the
 * same `createMunicipalityUpdate` transaction, which enforces `municipality`
 * scope and strips `adversarySignal` for non-staff.
 */
export const createCampaignUpdatesFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await createMunicipalityUpdate(parseMunicipalityUpdateFormData(formData))
      revalidatePath('/campanha/atualizacoes')
      return { message: 'Atualização registrada com sucesso.' }
    },
    genericMessage:
      'Não foi possível registrar a atualização. Verifique o município e seu acesso.',
  })
