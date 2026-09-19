import type { CollectionConfig } from 'payload'

import { RECORDING_MEDIA_SLUG } from '@/lib/recording'
import {
  canDeleteRecording,
  canReadRecording,
  canUploadRecording,
} from '@/utilities/campaignAccess'

/**
 * C199 — private upload collection of an uploaded recording's media. Like
 * `reelMedia`, deliberately NOT `media`: that collection is anonymous-read by
 * contract (public pages), while a recording file may only be read by the
 * communication roles. The browser reaches the file through the authenticated
 * `/campanha/comunicacao/acervo/gravacoes/[id]/arquivo` route, never the public
 * `/api/media/file` proxy.
 */

export const RecordingMedia: CollectionConfig = {
  slug: RECORDING_MEDIA_SLUG,
  labels: {
    singular: 'Mídia de gravação',
    plural: 'Mídias de gravação',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Arquivos privados das gravações enviadas ao acervo. Só abrem com login da campanha.',
  },
  access: {
    create: canUploadRecording,
    read: canReadRecording,
    update: canUploadRecording,
    delete: canDeleteRecording,
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
