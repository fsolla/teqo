import type { CollectionConfig } from 'payload'

import {
  SPEECH_CUT_DESCRIPTION_MAX_LENGTH,
  SPEECH_CUT_STATUSES,
  SPEECH_CUT_STEPS,
  SPEECH_CUT_TITLE_MAX_LENGTH,
  speechCutStatusLabels,
  speechCutStepLabels,
} from '@/lib/speechCut'
import {
  canDeleteSpeechCut,
  canReadSpeech,
  canReadSpeechCut,
  canSetCampaignSystemField,
} from '@/utilities/campaignAccess'
import { stampCampaignCreatedBy, systemStampedActorField } from '@/utilities/campaignAuditFields'
import { revalidateDocumentById } from '@/utilities/documents'

/**
 * C167 — published cuts of the speech acervo: the exact [start, end] MP4 with
 * AI-suggested (human-editable) title/description and the unlisted public page
 * `/corte/<id>`. Media is the stored file the public page plays and downloads;
 * `status` is the kill switch (`published` → `unpublished`). Source data is the
 * Câmara VOD (keep the CC BY credit) or, since C217, the private mirror of a
 * web speech (credit follows the real origin) — the credit is never the
 * Câmara's on third-party material.
 */

const STATUS_OPTIONS = SPEECH_CUT_STATUSES.map((value) => ({
  value,
  label: speechCutStatusLabels[value],
}))

const STEP_OPTIONS = SPEECH_CUT_STEPS.map((value) => ({
  value,
  label: speechCutStepLabels[value],
}))

export const SpeechCut: CollectionConfig = {
  slug: 'speechCut',
  labels: {
    singular: 'Corte',
    plural: 'Cortes',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'title',
    defaultColumns: ['title', 'speech', 'startSeconds', 'endSeconds', 'status', 'publishedAt'],
    description:
      'Cortes do acervo de falas publicados em /corte/<id>. Dados e vídeos da Câmara dos Deputados (CC BY 4.0) ou falas espelhadas da internet.',
  },
  access: {
    create: canReadSpeech,
    read: canReadSpeechCut,
    update: canReadSpeech,
    delete: canDeleteSpeechCut,
  },
  hooks: {
    beforeChange: [stampCampaignCreatedBy],
    afterChange: [
      ({ doc }) => {
        revalidateDocumentById('speechCut', doc.id)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        revalidateDocumentById('speechCut', doc.id)
      },
    ],
  },
  fields: [
    {
      name: 'speech',
      type: 'relationship',
      relationTo: 'speech',
      label: 'Discurso',
      index: true,
      admin: {
        description:
          'Fala de origem do corte. Preenchida pelo fluxo; fica vazia se a fala for excluída (o link público continua válido).',
      },
    },
    {
      name: 'startSeconds',
      type: 'number',
      label: 'Início (s)',
      required: true,
    },
    {
      name: 'endSeconds',
      type: 'number',
      label: 'Fim (s)',
      required: true,
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'Duração (s)',
      admin: { readOnly: true, description: 'Derivada do trecho escolhido.' },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      maxLength: SPEECH_CUT_TITLE_MAX_LENGTH,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      required: true,
      maxLength: SPEECH_CUT_DESCRIPTION_MAX_LENGTH,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Estado',
      required: true,
      defaultValue: 'processing',
      index: true,
      options: STATUS_OPTIONS,
      admin: {
        description: 'Despublicar tira o corte do ar na hora (kill switch).',
      },
    },
    {
      name: 'step',
      type: 'select',
      label: 'Passo',
      options: STEP_OPTIONS,
      admin: {
        readOnly: true,
        description: 'Progresso honesto do corte em andamento.',
      },
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      label: 'Arquivo (MP4)',
      admin: { readOnly: true, description: 'O arquivo que a página pública toca e baixa.' },
    },
    {
      name: 'error',
      type: 'textarea',
      label: 'Erro',
      admin: {
        readOnly: true,
        description: 'Motivo interno da falha; nunca vai ao público.',
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
