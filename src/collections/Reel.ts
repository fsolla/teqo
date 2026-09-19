import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload'

import {
  REEL_FEATURES,
  REEL_MEDIA_SLUG,
  REEL_STATUSES,
  REEL_TITLE_MAX_LENGTH,
  reelFeatureLabels,
  reelStatusLabels,
} from '@/lib/reel'
import { canDeleteReel, canReadReel, canSetCampaignSystemField } from '@/utilities/campaignAccess'
import { stampCampaignCreatedBy, systemStampedActorField } from '@/utilities/campaignAuditFields'

/**
 * C193 — one reel of tutorial of the site's functionalities, produced outside
 * the Teqo and registered here with its artifacts. Everything is private: the
 * files live in `reelMedia` and are served only through the authenticated
 * `/campanha/.../media/[kind]` route. `status` is the kill switch (`published`
 * → `unpublished`); approving never triggers an external action. The C194
 * library lists the published rows and the C195 ingest writes through the Local
 * API.
 */

const STATUS_OPTIONS = REEL_STATUSES.map((value) => ({ value, label: reelStatusLabels[value] }))
const FEATURE_OPTIONS = REEL_FEATURES.map((value) => ({ value, label: reelFeatureLabels[value] }))

const reelMediaField = ({
  name,
  label,
  description,
  required = false,
}: {
  name: string
  label: string
  description: string
  required?: boolean
}): Field => ({
  name,
  type: 'upload',
  relationTo: REEL_MEDIA_SLUG,
  label,
  required: required ?? false,
  admin: { description },
})

/**
 * Stamps `publishedAt` on every transition into `published` (create included),
 * so the C194 list can order by publication without each caller remembering it.
 * Leaving `published` never clears the stamp — it records the last publication.
 */
const stampReelPublishedAt: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (
    data.status === 'published' &&
    (operation === 'create' || originalDoc?.status !== 'published')
  ) {
    data.publishedAt = new Date().toISOString()
  }
  return data
}

export const Reel: CollectionConfig = {
  slug: 'reel',
  labels: {
    singular: 'Reel',
    plural: 'Reels',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'title',
    defaultColumns: ['title', 'feature', 'status', 'publishedAt'],
    description:
      'Reels de tutorial da assessoria. Os arquivos são privados e só abrem com login da campanha; publicar não dispara nada no Instagram.',
  },
  access: {
    create: canReadReel,
    read: canReadReel,
    update: canReadReel,
    delete: canDeleteReel,
  },
  hooks: {
    beforeChange: [stampReelPublishedAt, stampCampaignCreatedBy],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      maxLength: REEL_TITLE_MAX_LENGTH,
    },
    {
      name: 'feature',
      type: 'select',
      label: 'Funcionalidade-alvo',
      required: true,
      options: FEATURE_OPTIONS,
      admin: {
        description: 'Funcionalidade do site que o tutorial ensina.',
      },
    },
    {
      // C195 identity: re-ingesting the same package (same shot list hash)
      // updates this reel instead of creating a duplicate. Nullable so reels
      // registered by hand in the admin have no hash; unique so the database
      // itself refuses two reels with the same package.
      name: 'sourceHash',
      type: 'text',
      label: 'Hash do shot list',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Hash do shot list do pacote; identifica o reel na ingestão (C195).',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: STATUS_OPTIONS,
      admin: {
        description:
          'Despublicar tira o reel da biblioteca e para de servir os arquivos (kill switch).',
      },
    },
    reelMediaField({
      name: 'video',
      label: 'Vídeo (sem áudio, primário)',
      required: true,
      description: 'MP4 1080×1920 sem áudio — o arquivo principal que a assessoria baixa.',
    }),
    reelMediaField({
      name: 'videoWithAudio',
      label: 'Vídeo com áudio (rascunho)',
      description: 'Variante com a narração embutida, quando existir.',
    }),
    reelMediaField({
      name: 'narrationAudio',
      label: 'Narração (MP3)',
      description: 'Rascunho da narração em áudio, quando existir.',
    }),
    reelMediaField({
      name: 'captions',
      label: 'Legendas (.srt)',
      description: 'Arquivo de legenda pronto, vindo da produção.',
    }),
    reelMediaField({
      name: 'cover',
      label: 'Capa (1080×1920)',
      required: true,
      description: 'Imagem vertical usada na biblioteca e no player.',
    }),
    {
      name: 'transcript',
      type: 'textarea',
      label: 'Transcrição / roteiro',
      admin: {
        description: 'Texto da narração ou roteiro, vindo da produção.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Publicado em',
      admin: { readOnly: true },
    },
    systemStampedActorField({ setAccess: canSetCampaignSystemField }),
  ],
}
