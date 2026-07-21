'use server'

import { revalidatePath } from 'next/cache'

import { updateOrganization } from '@/app/(campaign)/campanha/actions/organization'
import {
  nullableFormText,
  optionalFormText,
  repeatedRelationshipFormValues,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { organizationKinds, type OrganizationKind } from '@/lib/schemas/organization'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const updateOrganizationFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  try {
    const rawKind = optionalFormText(formData, 'kind')
    await updateOrganization({
      id: requiredRelationshipFormValue(formData, 'organizationId'),
      kind: organizationKinds.includes(rawKind as OrganizationKind)
        ? (rawKind as OrganizationKind)
        : undefined,
      notes: nullableFormText(formData, 'notes'),
      plazas: repeatedRelationshipFormValues(formData, 'plazas'),
    })
    revalidatePath('/campanha/organizacoes/[slug]', 'page')
    return { status: 'success', message: 'Organização atualizada.' }
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: ['Somente a coordenação e a assessoria gerenciam organizações.'],
      genericMessage:
        'Não foi possível salvar a organização. Verifique seu acesso e tente novamente.',
    })
  }
}
