import type { CollectionConfig } from 'payload'

import { INTERNET_SPEECH_MEDIA_SLUG } from '@/lib/webSpeech'
import { canReadSpeech, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C215 — private upload collection of a web speech's mirrored artifact (the
 * media and the optional thumbnail). Like `recordingMedia`, deliberately NOT
 * `media`: that collection is anonymous-read by contract (public pages), while
 * a third-party speech file may only be read by the communication roles. The
 * browser reaches the file through the authenticated acervo route (C216),
 * never the public `/api/media/file` proxy.
 */

export const InternetSpeechMedia: CollectionConfig = {
  slug: INTERNET_SPEECH_MEDIA_SLUG,
  labels: {
    singular: 'Mídia de fala da internet',
    plural: 'Mídias de falas da internet',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Arquivos privados das falas encontradas na internet (mídia espelhada e capa). Só abrem com login da campanha.',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadSpeech,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
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
