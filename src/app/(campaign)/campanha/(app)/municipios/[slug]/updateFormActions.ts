'use server'

import { revalidatePath } from 'next/cache'

import { createMunicipalityUpdate } from '@/app/(campaign)/campanha/actions/municipalityUpdate'
import {
  checkboxFormValue,
  optionalFormText,
  optionalIntegerFormValue,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  municipalityUpdateKinds,
  parseMunicipalitySignalType,
  type MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createMunicipalityUpdateFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const municipality = requiredRelationshipFormValue(formData, 'municipalityId')
      const rawKind = requiredFormText(formData, 'kind')
      const kind = municipalityUpdateKinds.includes(rawKind as MunicipalityUpdateKind)
        ? (rawKind as MunicipalityUpdateKind)
        : 'semanal'

      await createMunicipalityUpdate({
        municipality,
        kind,
        worked: optionalFormText(formData, 'worked'),
        failed: optionalFormText(formData, 'failed'),
        needs: optionalFormText(formData, 'needs'),
        body: optionalFormText(formData, 'body'),
        activeVolunteers: optionalIntegerFormValue(formData, 'activeVolunteers'),
        newSupports: optionalIntegerFormValue(formData, 'newSupports'),
        signalType: parseMunicipalitySignalType(optionalFormText(formData, 'signalType')),
        signalSource: optionalFormText(formData, 'signalSource'),
        triangulated: checkboxFormValue(formData, 'triangulated'),
      })
      revalidatePath('/campanha/municipios/[slug]', 'page')
      return { message: 'Atualização registrada com sucesso.' }
    },
    genericMessage:
      'Não foi possível registrar a atualização. Verifique seu acesso e tente novamente.',
  })
