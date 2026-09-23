import type { CollectionConfig } from 'payload'

import { CONTENT_MEDIA_SLUG } from '@/lib/contentPiece'
import { canReadContentPiece, canUpdateContentPiece } from '@/utilities/campaignAccess'

/**
 * C211 — private upload collection of a content piece's media. Like
 * `recordingMedia`/`reelMedia`, deliberately NOT `media`: that collection is
 * anonymous-read by contract (public pages), while a piece file may only be
 * read by the communication roles until it is published. The browser reaches
 * the file through the authenticated
 * `/campanha/comunicacao/conteudos/[id]/arquivo` route; the public Central
 * (S27) owns its own serving surface for published pieces, over this same
 * object — never a second copy.
 */

export const ContentMedia: CollectionConfig = {
  slug: CONTENT_MEDIA_SLUG,
  labels: {
    singular: 'Mídia de peça',
    plural: 'Mídias de peças',
  },
  admin: {
    group: 'Comunicação',
    description: 'Arquivos das peças da Central de Conteúdos. Só abrem com login da campanha.',
  },
  access: {
    create: canUpdateContentPiece,
    read: canReadContentPiece,
    update: canUpdateContentPiece,
    delete: canUpdateContentPiece,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      required: true,
      admin: {
        description: 'Descrição do arquivo para acessibilidade.',
      },
    },
  ],
  upload: true,
}
