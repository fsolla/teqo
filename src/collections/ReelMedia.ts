import type { CollectionConfig } from 'payload'

import { REEL_MEDIA_SLUG } from '@/lib/reel'
import { canDeleteReel, canReadReel } from '@/utilities/campaignAccess'

/**
 * C193 — private upload collection of a reel's artifacts. Deliberately NOT
 * `media`: that collection is anonymous-read by contract (public pages), while
 * a reel file may only be read by the communication roles. The browser reaches
 * these files through the authenticated
 * `/campanha/comunicacao/reels/[id]/media/[kind]` route, never the public
 * `/api/media/file` proxy.
 */

export const ReelMedia: CollectionConfig = {
  slug: REEL_MEDIA_SLUG,
  labels: {
    singular: 'Mídia de reel',
    plural: 'Mídias de reel',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Arquivos privados dos reels (vídeo, narração, legenda, capa). Só abrem com login da campanha.',
  },
  access: {
    create: canReadReel,
    read: canReadReel,
    update: canReadReel,
    delete: canDeleteReel,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      required: true,
      admin: {
        description: 'Descrição do artefato para acessibilidade (capa e vídeo).',
      },
    },
  ],
  upload: true,
}
