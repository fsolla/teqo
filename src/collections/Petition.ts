import { normalizeFacebookPixelId } from '@/lib/facebookPixel'
import { payloadAdminOnly } from '@/utilities/campaignAccess'
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
      schedulePublish: true,
    },
    maxPerDoc: 5,
  },
  access: {
    read: () => true,
    readVersions: payloadAdminOnly,
    create: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.tracking?.facebookPixelId != null) {
          data.tracking.facebookPixelId = normalizeFacebookPixelId(data.tracking.facebookPixelId)
        }
        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc, operation }) => {
        // Admin create view creates the initial draft during render.
        // Skip cache invalidation only for that first draft creation.
        if (operation === 'create' && doc._status !== 'published') return

        revalidateDocumentById(slug, previousDoc?.id ?? doc.id)
      },
    ],
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
    {
      name: 'tracking',
      type: 'group',
      label: 'Rastreamento / Ads',
      fields: [
        {
          name: 'facebookPixelId',
          type: 'text',
          label: 'ID do Pixel do Meta (Facebook)',
          admin: {
            description:
              'Cole somente o ID numérico do Events Manager (ex.: 123456789012345), não o snippet HTML completo.',
          },
          validate: (value: string | null | undefined) => {
            if (!value) return true
            if (!normalizeFacebookPixelId(String(value))) {
              return 'Informe somente o ID numérico do Pixel (5 a 20 dígitos), sem HTML ou script.'
            }
            return true
          },
        },
      ],
    },
  ],
}
