import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  canCreateStateDeputy,
  canDeleteStateDeputy,
  canManageStateDeputy,
  canReadStateDeputy,
  canSetCampaignSystemField,
} from '@/utilities/campaignAccess'
import { slugify } from '@/lib/slug'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const setCanonicalStateDeputySlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const name = trimmedText(data.name ?? originalDoc?.name)
  const slug = slugify(name)
  if (!slug) {
    throw new APIError('Informe um nome com letras ou números.', 400)
  }
  if (operation === 'update' && data.name !== undefined && name !== originalDoc?.name) {
    throw new APIError('O nome da dobradinha não pode ser alterado após a criação.', 409)
  }
  data.name = name
  data.slug = operation === 'create' ? slug : originalDoc?.slug
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
    beforeValidate: [setCanonicalStateDeputySlug],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user?.collection === 'campaignUser') {
          data.createdBy = req.user.id
        }

        return data
      },
    ],
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
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Criado por',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
  ],
}
