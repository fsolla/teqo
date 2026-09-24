import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import {
  RECORDING_MEDIA_SLUG,
  RECORDING_SPEAKER_LABEL_MAX_LENGTH,
  RECORDING_STATUSES,
  RECORDING_STEPS,
  RECORDING_TITLE_MAX_LENGTH,
  recordingStatusLabels,
  recordingStepLabels,
} from '@/lib/recording'
import { speakerNamesFromLabels } from '@/lib/recordingDiarization'
import { SPEECH_CLASSIFICATION_SOURCES, SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
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

/**
 * C200 — `speakerNames` is derived from the human labels so the "Pessoa" facet
 * filters one denormalized array instead of joining segments. Mirrors
 * `RecordingSegment.deriveSearchText`: `originalDoc` covers every update that
 * does not touch the labels (status, searchText, step).
 */
const deriveSpeakerNames: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  // An explicit array (even empty) is the new truth; only an untouched field
  // falls back to the stored document.
  const labels = data.speakerLabels === undefined ? originalDoc?.speakerLabels : data.speakerLabels
  data.speakerNames = speakerNamesFromLabels(labels)
  return data
}

/**
 * C219 — the "Ano" facet is derived from the recording date the team already
 * informed (`recordedAt`), never a second hand-typed field. A recording without
 * a date honestly has no year (it stays out of the year filter).
 */
const deriveRecordingYear: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const recordedAt =
    typeof data.recordedAt === 'string' ? data.recordedAt : (originalDoc?.recordedAt ?? null)
  const year = Number(String(recordedAt ?? '').slice(0, 4))
  // Clearing the date clears the derived year too — a stale year would keep the
  // recording in an "Ano" facet the team just removed.
  data.year = Number.isInteger(year) && year > 1900 ? year : null
  return data
}
const FACET_FIELDS = ['topics', 'scopes', 'classifiedBy', 'mentionedMunicipalities'] as const

/**
 * C219 — a manual facet correction is curation: unauthenticated writes (the
 * transcription job and the backfill CLI) never overwrite it. Authenticated
 * admin edits stay free to change both the facets and the provenance.
 */
const preserveManualFacets: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || operation !== 'update' || originalDoc?.classifiedBy !== 'manual') return data
  if (req.user) return data

  const next = data as Record<string, unknown>
  for (const field of FACET_FIELDS) {
    if (field in next) next[field] = originalDoc[field]
  }
  return data
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
    defaultColumns: ['title', 'recordedAt', 'status', 'topics', 'classifiedBy'],
    description:
      'Gravações próprias da equipe no acervo. O arquivo é privado; a transcrição é somente leitura. Tema, alcance e municípios citados são classificados automaticamente pelo início da transcrição e podem ser corrigidos aqui (a correção vira proveniência "Manual").',
  },
  access: {
    create: canUploadRecording,
    read: canReadRecording,
    update: canUploadRecording,
    delete: canDeleteRecording,
  },
  hooks: {
    beforeValidate: [deriveSpeakerNames, deriveRecordingYear],
    beforeChange: [preserveManualFacets, stampCampaignCreatedBy],
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
      name: 'year',
      type: 'number',
      label: 'Ano',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derivado da data da gravação.',
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
      name: 'topics',
      type: 'select',
      label: 'Temas',
      hasMany: true,
      index: true,
      options: SPEECH_TOPICS.map(({ value, label }) => ({ value, label })),
    },
    {
      name: 'scopes',
      type: 'select',
      label: 'Alcance',
      hasMany: true,
      index: true,
      options: SPEECH_SCOPES.map(({ value, label }) => ({ value, label })),
    },
    {
      name: 'classifiedBy',
      type: 'select',
      label: 'Proveniência da classificação',
      // Optional on purpose: a recording from before C219 was never classified,
      // and stamping it `gazetteer` would claim a pass that never ran. Null is
      // the honest "não classificada" until the backfill CLI runs.
      index: true,
      options: SPEECH_CLASSIFICATION_SOURCES.map((value) => ({
        value,
        label: value === 'gazetteer' ? 'Gazetteer' : value === 'llm' ? 'LLM' : 'Manual',
      })),
      admin: {
        description:
          'Automática e auditável: Gazetteer (léxico), LLM (refinamento validado) ou Manual (correção humana).',
      },
    },
    {
      name: 'mentionedMunicipalities',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Municípios citados',
      hasMany: true,
      index: true,
    },
    {
      name: 'speakerLabels',
      type: 'array',
      label: 'Falantes identificados',
      admin: {
        readOnly: true,
        description:
          'Rótulos humanos por agrupamento acústico (chave → nome). Identificação sempre humana; o acervo nunca sugere ou infere pessoas.',
      },
      fields: [
        {
          name: 'speakerKey',
          type: 'text',
          label: 'Agrupamento',
          required: true,
        },
        {
          name: 'label',
          type: 'text',
          label: 'Nome do falante',
          required: true,
          maxLength: RECORDING_SPEAKER_LABEL_MAX_LENGTH,
        },
      ],
    },
    {
      name: 'speakerNames',
      type: 'text',
      label: 'Pessoas (busca)',
      hasMany: true,
      admin: {
        readOnly: true,
        description:
          'Derivado dos rótulos (sem duplicatas, sem diferenciar maiúsculas) para a faceta "Pessoa".',
      },
    },
    {
      name: 'speakerLabelsDropped',
      type: 'checkbox',
      label: 'Identificações perdidas no reprocessamento',
      admin: {
        readOnly: true,
        description:
          'Ligado quando um reprocessamento reordenou os agrupamentos e algum rótulo não pôde ser re-vinculado.',
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
