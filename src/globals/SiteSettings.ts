import {
  FACEBOOK_PIXEL_ID_DESCRIPTION,
  normalizeFacebookPixelId,
  validateFacebookPixelId,
} from '@/lib/facebookPixel'
import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateGlobal } from '@/utilities/globals'
import type { GlobalConfig } from 'payload'

const slug = 'site-settings'

const revalidate = async () => revalidateGlobal(slug)

export const SiteSettings: GlobalConfig = {
  slug,
  label: 'Configurações do site',
  admin: {
    group: 'Configurações',
  },
  access: {
    read: () => true,
    // Site-wide config: campaign JWTs authenticate against /api/*, so "any
    // authenticated user" here was a write path into the public site (Pass 4).
    update: payloadAdminOnly,
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
    afterChange: [revalidate],
  },
  fields: [
    {
      name: 'headerTitle',
      type: 'text',
      label: 'Título do cabeçalho',
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Redes sociais',
      labels: {
        singular: 'Rede social',
        plural: 'Redes sociais',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          label: 'Plataforma',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'WhatsApp', value: 'whatsapp' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value) return 'A URL é obrigatória'
            try {
              const parsed = new URL(value)
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                return 'A URL deve começar com http:// ou https://'
              }
              return true
            } catch {
              return 'Informe uma URL válida'
            }
          },
        },
        {
          name: 'label',
          type: 'text',
          label: 'Rótulo de acessibilidade',
          admin: {
            description:
              'Rótulo opcional para acessibilidade. Se estiver vazio, usamos um rótulo padrão da plataforma.',
          },
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Ativo',
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
            description: FACEBOOK_PIXEL_ID_DESCRIPTION,
          },
          validate: validateFacebookPixelId,
        },
      ],
    },
  ],
  versions: {
    drafts: {
      autosave: {
        interval: 1000,
      },
      schedulePublish: true,
    },
    max: 10,
  },
}
