import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
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
import { assertStateDeputyNameAvailable } from '@/utilities/stateDeputy/nameInvariant'

const setCanonicalStateDeputySlug: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  if (operation === 'update') {
    const contactID = relationshipId(data.contact ?? originalDoc?.contact)
    if (contactID !== null) {
      const contact = await req.payload.findByID({
        collection: 'contact',
        id: contactID,
        depth: 0,
        select: { name: true },
        // Intentional bypass: this read derives the invariant name after the
        // authorized StateDeputy relation update.
        overrideAccess: true,
        req,
      })
      await assertStateDeputyNameAvailable(req.payload, req, contact.name, originalDoc?.id)
    }
    data.slug = originalDoc?.slug ?? data.slug
    return data
  }

  const contactID = relationshipId(data.contact)
  if (contactID === null) {
    throw new APIError('O contato da dobradinha é obrigatório.', 400)
  }

  return req.payload
    .findByID({
      collection: 'contact',
      id: contactID,
      depth: 0,
      select: { name: true },
      // Intentional bypass: the create action has already authorized the staff
      // actor; this lookup only derives the immutable legacy alias from Contact.
      overrideAccess: true,
      req,
    })
    .then((contact) => {
      const name = trimmedText(contact.name)
      const slug = slugify(name)
      if (!slug) {
        throw new APIError(STATE_DEPUTY_NAME_REQUIRED_MESSAGE, 400)
      }

      return assertStateDeputyNameAvailable(req.payload, req, name).then(() => {
        data.slug = slug
        return data
      })
    })
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
    useAsTitle: 'contact',
    defaultColumns: ['contact', 'party', 'updatedAt'],
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
      name: 'contact',
      type: 'relationship',
      relationTo: 'contact',
      label: 'Contato',
      required: true,
      unique: true,
      index: true,
      access: {
        update: canSetCampaignSystemField,
      },
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
