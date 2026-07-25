import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { slugify } from '@/lib/slug'
import {
  canCreateOrganization,
  canDeleteOrganization,
  canManageOrganization,
  canReadOrganization,
  canSetCampaignSystemField,
} from '@/utilities/campaignAccess'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const setCanonicalOrganizationSlug: CollectionBeforeValidateHook = ({
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
    throw new APIError('O nome da organização não pode ser alterado após a criação.', 409)
  }
  data.name = name
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

export const Organization: CollectionConfig = {
  slug: 'organization',
  labels: {
    singular: 'Organização',
    plural: 'Organizações',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'updatedAt'],
    description:
      'Sindicatos, associações, movimentos e afins. Concentra lideranças associadas e Atividades apoiadas.',
  },
  access: {
    create: canCreateOrganization,
    read: canReadOrganization,
    update: canManageOrganization,
    delete: canDeleteOrganization,
  },
  hooks: {
    beforeValidate: [setCanonicalOrganizationSlug],
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
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: [
        { label: 'Sindicato', value: 'sindicato' },
        { label: 'Associação', value: 'associacao' },
        { label: 'Religiosa', value: 'religioso' },
        { label: 'Movimento', value: 'movimento' },
        { label: 'Categoria profissional', value: 'categoria_profissional' },
        { label: 'Outro', value: 'outro' },
      ],
    },
    {
      name: 'municipalities',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Municípios de atuação',
      hasMany: true,
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
