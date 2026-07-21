'use server'

import { revalidatePath } from 'next/cache'

import { createPlazaUpdate } from '@/app/(campaign)/campanha/actions/plazaUpdate'
import {
  optionalFormText,
  optionalIntegerFormValue,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { plazaUpdateKinds, type PlazaUpdateKind } from '@/lib/schemas/plazaUpdate'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createPlazaUpdateFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const plaza = requiredRelationshipFormValue(formData, 'plazaId')
    const rawKind = requiredFormText(formData, 'kind')
    const kind = plazaUpdateKinds.includes(rawKind as PlazaUpdateKind)
      ? (rawKind as PlazaUpdateKind)
      : 'semanal'

    await createPlazaUpdate({
      plaza,
      kind,
      worked: optionalFormText(formData, 'worked'),
      failed: optionalFormText(formData, 'failed'),
      needs: optionalFormText(formData, 'needs'),
      body: optionalFormText(formData, 'body'),
      activeVolunteers: optionalIntegerFormValue(formData, 'activeVolunteers'),
      newSupports: optionalIntegerFormValue(formData, 'newSupports'),
    })
    revalidatePath('/campanha/pracas/[slug]', 'page')
    return { status: 'success', message: 'Atualização registrada com sucesso.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      genericMessage:
        'Não foi possível registrar a atualização. Verifique seu acesso e tente novamente.',
    })
  }
}
