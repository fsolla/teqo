import type { CollectionConfig } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import { canReadArchivePhoto, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C231 — private upload collection of the Flickr photo archive: the ORIGINAL
 * file plus the metadata the Flickr listing brought (date, albums,
 * title/description/tags, geotag, EXIF). Like `internetSpeechMedia` and
 * `recordingMedia`, deliberately NOT `media`: that collection is anonymous-read
 * by contract (public pages), while the raw archive may only be read by the
 * communication roles. It is ingested by `pnpm flickr:import` and nothing here
 * publishes — C232 curates, C233/C234 publish.
 *
 * `alt` is required by the upload contract and derived by the ingestion
 * (`archivePhotoAlt`); the remaining Flickr fields document provenance and feed
 * the catalogue. The stored name is deterministic (`flickr-<id>.<ext>`), so a
 * re-run converges by overwriting the same object key.
 */

export const ArchivePhoto: CollectionConfig = {
  slug: ARCHIVE_PHOTO_SLUG,
  labels: {
    singular: 'Foto do acervo',
    plural: 'Fotos do acervo',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Originais e metadados do acervo de fotos do Flickr (conta depjorgesolla). Só abrem com login da campanha.',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadArchivePhoto,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'flickrId',
      type: 'text',
      label: 'ID no Flickr',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Identidade da foto no Flickr — a chave que torna a ingestão idempotente.',
      },
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      required: true,
      admin: {
        description: 'Descrição do arquivo para acessibilidade.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Título no Flickr',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição no Flickr',
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags do Flickr',
      labels: { singular: 'Tag', plural: 'Tags' },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Tag',
          required: true,
        },
      ],
    },
    {
      name: 'takenAt',
      type: 'text',
      label: 'Data da foto',
      admin: {
        description: 'Data informada pelo Flickr, sem fuso (YYYY-MM-DD HH:MM:SS).',
      },
    },
    {
      name: 'postedAt',
      type: 'text',
      label: 'Publicada em',
      admin: {
        description: 'Data de publicação no Flickr (ISO 8601, UTC).',
      },
    },
    {
      name: 'albums',
      type: 'array',
      label: 'Álbuns',
      labels: { singular: 'Álbum', plural: 'Álbuns' },
      fields: [
        {
          name: 'albumId',
          type: 'text',
          label: 'ID do álbum',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          label: 'Título do álbum',
          required: true,
        },
      ],
    },
    {
      name: 'geo',
      type: 'group',
      label: 'Geotag',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          label: 'Latitude',
        },
        {
          name: 'longitude',
          type: 'number',
          label: 'Longitude',
        },
      ],
    },
    {
      name: 'exif',
      type: 'json',
      label: 'EXIF',
      admin: {
        description: 'Metadados EXIF da foto, como o Flickr respondeu ({ tag, label, value }).',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Página no Flickr',
    },
    {
      name: 'owner',
      type: 'text',
      label: 'Conta (NSID)',
    },
    {
      name: 'license',
      type: 'text',
      label: 'Licença (Flickr)',
    },
  ],
  upload: true,
}
