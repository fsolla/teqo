import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { uniqueRelationshipIds } from '@/lib/relationship'
import { STATE_DEPUTY_NAME_REQUIRED_MESSAGE } from '@/lib/schemas/stateDeputy'
import { slugify } from '@/lib/slug'
import { trimmedText } from '@/lib/text'
import {
  canAssignStateDeputyAdvisors,
  canCreateStateDeputy,
  canDeleteStateDeputy,
  canManageStateDeputy,
  canManageStateDeputyAdvisors,
  canReadStateDeputy,
  canSetCampaignSystemField,
  eligibleCampaignStaffWhere,
} from '@/utilities/campaignAccess'
import { stampCampaignCreatedBy, systemStampedActorField } from '@/utilities/campaignAuditFields'

const setCanonicalStateDeputySlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const name = trimmedText(data.name ?? originalDoc?.name)
  const slug = slugify(name)
  if (!slug) {
    throw new APIError(STATE_DEPUTY_NAME_REQUIRED_MESSAGE, 400)
  }
  if (operation === 'update' && data.name !== undefined && name !== originalDoc?.name) {
    throw new APIError('O nome da dobradinha não pode ser alterado após a criação.', 409)
  }
  data.name = name
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

const validateStateDeputyAdvisors: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data || data.advisors === undefined) return data

  const advisorIDs = Array.isArray(data.advisors) ? uniqueRelationshipIds(data.advisors) : []
  if (advisorIDs.length === 0) return data

  const eligibleAdvisors = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: advisorIDs } }, eligibleCampaignStaffWhere],
    },
    select: { name: true },
    // Intentional admin bypass: eligibility is a pure role check that must run
    // for every caller (including /admin), independent of the actor's read
    // scope over `campaignUser` — mirrors `validateMunicipalityAdvisors`.
    overrideAccess: true,
    req,
  })

  if (eligibleAdvisors.docs.length !== advisorIDs.length) {
    throw new APIError(
      'Cada assessor deve ter papel de Coordenador Geral, Assessor ou Candidato.',
      400,
    )
  }

  return data
}

export const StateDeputy: CollectionConfig = {
  slug: 'stateDeputy',
  labels: {
    singular: 'Dobradinha',
    plural: 'Dobradinhas',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
    defaultColumns: ['name', 'party', 'updatedAt'],
    description:
      'Deputados estaduais com quem a campanha dobra. Vincule a municípios e lideranças nas fichas correspondentes.',
  },
  access: {
    create: canCreateStateDeputy,
    read: canReadStateDeputy,
    update: canManageStateDeputy,
    delete: canDeleteStateDeputy,
  },
  hooks: {
    beforeValidate: [setCanonicalStateDeputySlug, validateStateDeputyAdvisors],
    beforeChange: [stampCampaignCreatedBy],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      required: true,
      minLength: 2,
      maxLength: 160,
      unique: true,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'party',
      type: 'text',
      label: 'Partido',
      maxLength: 32,
      index: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Observações',
      maxLength: 4000,
    },
    {
      name: 'advisors',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Assessores',
      hasMany: true,
      index: true,
      access: {
        create: canAssignStateDeputyAdvisors,
        update: canManageStateDeputyAdvisors,
      },
      filterOptions: eligibleCampaignStaffWhere,
    },
    systemStampedActorField({ setAccess: canSetCampaignSystemField }),
  ],
}
