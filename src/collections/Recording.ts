import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

import {
  RECORDING_MEDIA_SLUG,
  RECORDING_STATUSES,
  RECORDING_STEPS,
  RECORDING_TITLE_MAX_LENGTH,
  recordingStatusLabels,
  recordingStepLabels,
} from '@/lib/recording'
import {
  canDeleteRecording,
  canReadRecording,
  canSetCampaignSystemField,
  canUploadRecording,
} from '@/utilities/campaignAccess'
import { stampCampaignCreatedBy, systemStampedActorField } from '@/utilities/campaignAuditFields'

/**
 * C199 — one recording uploaded by the communication team (plenária, debate,
 * material próprio) and turned into a searchable acervo source with player and
 * timestamped transcript. `status`/`step`/`error` are the honest processing
 * states of the transcription job; `media` is the private file, served only
 * through the authenticated route under `/campanha`.
 */

const STATUS_OPTIONS = RECORDING_STATUSES.map((value) => ({
  value,
  label: recordingStatusLabels[value],
}))

const STEP_OPTIONS = RECORDING_STEPS.map((value) => ({
  value,
  label: recordingStepLabels[value],
}))

/** Segments are owned by the recording; Payload relationships do not cascade. */
const deleteRecordingSegments: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'recordingSegment',
    where: { recording: { equals: id } },
    req,
    // Intentional bypass: the cascade is owned by this hook; segment access is
    // admin-only and this runs inside the authorized recording delete request.
    overrideAccess: true,
  })
}

export const Recording: CollectionConfig = {
  slug: 'recording',
  labels: {
    singular: 'Gravação',
    plural: 'Gravações',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'title',
    defaultColumns: ['title', 'recordedAt', 'status', 'durationSeconds', 'createdAt'],
    description:
      'Gravações próprias da equipe no acervo. O arquivo é privado; a transcrição é somente leitura.',
  },
  access: {
    create: canUploadRecording,
    read: canReadRecording,
    update: canUploadRecording,
    delete: canDeleteRecording,
  },
  hooks: {
    beforeChange: [stampCampaignCreatedBy],
    beforeDelete: [deleteRecordingSegments],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      maxLength: RECORDING_TITLE_MAX_LENGTH,
    },
    {
      name: 'recordedAt',
      type: 'date',
      label: 'Data da gravação',
      index: true,
      admin: {
        description: 'Data em que a gravação foi feita (opcional).',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      defaultValue: 'uploading',
      index: true,
      options: STATUS_OPTIONS,
    },
    {
      name: 'step',
      type: 'select',
      label: 'Passo',
      options: STEP_OPTIONS,
      admin: {
        readOnly: true,
        description: 'Progresso honesto da transcrição em andamento.',
      },
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: RECORDING_MEDIA_SLUG,
      label: 'Arquivo da gravação',
      admin: {
        readOnly: true,
        description: 'O arquivo privado que o player toca e o download entrega.',
      },
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'Duração (s)',
      admin: {
        readOnly: true,
        description: 'Derivada do áudio transcrito.',
      },
    },
    {
      name: 'searchText',
      type: 'textarea',
      label: 'Texto normalizado (busca)',
      admin: {
        readOnly: true,
        description: 'Concatenação normalizada dos segmentos (sem acentos, minúsculas).',
      },
    },
    {
      name: 'error',
      type: 'textarea',
      label: 'Erro',
      admin: {
        readOnly: true,
        description: 'Motivo interno da falha; nunca vai à pessoa com o detalhe cru.',
      },
    },
    systemStampedActorField({ setAccess: canSetCampaignSystemField }),
  ],
}
