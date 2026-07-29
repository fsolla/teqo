'use server'

import { createOrganization } from '@/app/(campaign)/campanha/actions/organization'
import { optionalFormText, repeatedRelationshipFormValues, requiredFormText } from '@/lib/formData'
import {
  ORGANIZATION_CONFLICT_MESSAGE,
  ORGANIZATION_STAFF_MESSAGE,
  organizationKinds,
  type OrganizationKind,
} from '@/lib/schemas/organization'
import {
  runCampaignRedirectFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

export const createOrganizationFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignRedirectFormAction({
    execute: () => {
      const rawKind = requiredFormText(formData, 'kind')
      return createOrganization({
        name: requiredFormText(formData, 'name'),
        kind: organizationKinds.includes(rawKind as OrganizationKind)
          ? (rawKind as OrganizationKind)
          : 'outro',
        notes: optionalFormText(formData, 'notes'),
        municipalities: repeatedRelationshipFormValues(formData, 'municipalities'),
      })
    },
    redirectTo: (organization) => `/campanha/organizacoes/${organization.slug}`,
    safeMessages: [ORGANIZATION_CONFLICT_MESSAGE, ORGANIZATION_STAFF_MESSAGE],
    genericMessage:
      'Não foi possível cadastrar a organização. Verifique os dados e tente novamente.',
  })
