import { revalidateDocumentById } from '@/utilities/documents'
import type { CollectionConfig } from 'payload'

const slug = 'petition'

export const Petition: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Abaixo-assinado',
    plural: 'Abaixo-assinados',
  },
  admin: {
    group: 'Abaixo-assinados',
    useAsTitle: 'title',
    livePreview: {
      url: ({ data }) => `/abaixo-assinado/${data.id}`,
    },
  },
  versions: {
    drafts: {
      autosave: {
        interval: 1000,
      },
      schedulePublish: true,
    },
    maxPerDoc: 5,
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [({ data }) => revalidateDocumentById(slug, data.id)],
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      label: 'Trecho Identificador da URL',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
      label: 'Subtítulo',
      required: true,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Ativo',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Corpo',
      required: true,
    },
    {
      name: 'form',
      type: 'group',
      label: 'Formulário',
      required: true,
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Título',
        },
        {
          name: 'subtitle',
          type: 'text',
          label: 'Subtítulo',
        },
        {
          name: 'consent',
          type: 'relationship',
          label: 'Consentimento',
          relationTo: 'consent',
          required: true,
        },
      ],
    },
  ],
}
