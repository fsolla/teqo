'use server'

import { redirect } from 'next/navigation'

import { createOrganization } from '@/app/(campaign)/campanha/actions/organization'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import { organizationKinds, type OrganizationKind } from '@/lib/schemas/organization'
import {
  mapCampaignFormActionError,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createOrganizationFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> => {
  let createdSlug: string | null = null
  try {
    const rawKind = requiredFormText(formData, 'kind')
    const organization = await createOrganization({
      name: requiredFormText(formData, 'name'),
      kind: organizationKinds.includes(rawKind as OrganizationKind)
        ? (rawKind as OrganizationKind)
        : 'outro',
      notes: optionalFormText(formData, 'notes'),
      plazas: repeatedRelationshipFormValues(formData, 'plazas'),
    })
    createdSlug = organization.slug
  } catch (error) {
    return mapCampaignFormActionError({
      error,
      safeMessages: [
        'Já existe uma organização com este nome.',
        'Somente a coordenação e a assessoria gerenciam organizações.',
      ],
      genericMessage:
        'Não foi possível cadastrar a organização. Verifique os dados e tente novamente.',
    })
  }

  redirect(`/campanha/organizacoes/${createdSlug}`)
}
